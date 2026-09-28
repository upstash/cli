import { Bucket, BlobError } from "@upstash/blob";
import { Command } from "commander";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BucketResolver } from "../../src/commands/blob/buckets.js";
import { parseBlobLocation, parseBucket, putFile } from "../../src/commands/blob/transfer.js";
import { createBlobProgram, runCommand } from "../helpers/program.js";

let directory: string;
const originalEnv = { ...process.env };

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "blob-transfer-test-"));
  delete process.env.UPSTASH_BLOB_TOKEN;
  delete process.env.UPSTASH_EMAIL;
  delete process.env.UPSTASH_API_KEY;
  process.env.UPSTASH_CONFIG_HOME = directory;
  process.env.UPSTASH_LEGACY_CONFIG_HOME = directory;
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Unexpected network request in offline test"));
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  process.env = { ...originalEnv };
  await rm(directory, { recursive: true, force: true });
});

function token(id: string = randomUUID()): string {
  const bucket = Buffer.from(id);
  const password = Buffer.from("fixture-password");
  const hash = Buffer.from("fixture");
  return Buffer.concat([Buffer.from([2, 0, bucket.length, 0, password.length, hash.length]), bucket, password, hash]).toString("base64url");
}

function storageCredentials(session = "session", expiresAt = Date.now() / 1000 + 600): Response {
  return Response.json({
    accessKeyId: "key", secretAccessKey: "secret", sessionToken: session, expiresAt,
    endpoint: "https://fixture.r2.cloudflarestorage.com", bucket: "fixture-bucket", region: "auto",
  });
}

async function consume(body: Parameters<Bucket["put"]>[1]): Promise<void> {
  if (!(body instanceof ReadableStream)) throw new Error("expected a stream");
  const reader = body.getReader();
  while (!(await reader.read()).done) { /* drain the fixture stream */ }
}

async function file(name = "file.txt", content: string | Buffer = "hello") {
  const source = join(directory, name);
  await writeFile(source, content);
  return { source, key: name, size: Buffer.byteLength(content), contentType: "text/plain" };
}

describe("bucket paths", () => {
  it("accepts a bucket path with or without blob://", () => {
    expect(parseBlobLocation("my-bucket/a/b.txt")).toEqual({ type: "blob", bucket: "my-bucket", key: "a/b.txt" });
    expect(parseBlobLocation("my-bucket")).toEqual({ type: "blob", bucket: "my-bucket", key: "" });
    expect(parseBlobLocation("blob://my-bucket/a")).toEqual({ type: "blob", bucket: "my-bucket", key: "a" });
    expect(() => parseBlobLocation("s3://my-bucket/a")).toThrow("unsupported location");
    expect(() => parseBlobLocation("/a")).toThrow("has no bucket");
    expect(parseBucket("my-bucket/")).toBe("my-bucket");
    expect(() => parseBucket("my-bucket/key")).toThrow("includes a key");
  });

  it("takes short flags", async () => {
    await writeFile(join(directory, "a.txt"), "a");
    const result = await runCommand(await createBlobProgram(), ["blob", "cp", directory, "blob://bucket/dest", "-r", "-n", "-q"]);
    expect(result).toMatchObject({ dry_run: true, operations: [{ destination: "blob://bucket/dest/a.txt" }] });
    const program = await createBlobProgram();
    const blob = program.commands.find((command) => command.name() === "blob")!;
    const flags = (name: string) => blob.commands.find((command) => command.name() === name)!.options.map((option) => option.short);
    expect(flags("sync")).toEqual(expect.arrayContaining(["-d", "-n", "-q"]));
    expect(flags("rm")).toEqual(expect.arrayContaining(["-r", "-n", "-q"]));
    expect(flags("rb")).toEqual(expect.arrayContaining(["-f", "-q"]));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("checks arguments before any request", async () => {
    await expect(runCommand(await createBlobProgram(), ["blob", "cp", directory, "blob://bucket/x", "-r", "--concurrency", "0"]))
      .rejects.toThrow("1 to 16");
    await expect(runCommand(await createBlobProgram(), ["blob", "rm", "build", "-r"])).rejects.toThrow("write blob://build");
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("putFile", () => {
  it("reopens the stream when retrying a transient failure", async () => {
    let attempts = 0;
    const bodies: unknown[] = [];
    const bucket = {
      put: vi.fn(async (_key, body) => {
        bodies.push(body);
        await consume(body);
        if (++attempts === 1) throw new BlobError("request_failed", { status: 503 });
        return {};
      }),
    } as unknown as Pick<Bucket, "put">;
    await putFile(bucket, await file());
    expect(attempts).toBe(2);
    expect(bodies[0]).not.toBe(bodies[1]);
  });

  it("retries a credential request that timed out, but not a rejected one", async () => {
    let attempts = 0;
    const flaky = {
      put: vi.fn(async () => {
        if (++attempts === 1) throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
        return {};
      }),
    } as unknown as Pick<Bucket, "put">;
    await putFile(flaky, await file());
    expect(attempts).toBe(2);
    const denied = { put: vi.fn().mockRejectedValue(new BlobError("unauthorized")) };
    await expect(putFile(denied, await file())).rejects.toThrow();
    expect(denied.put).toHaveBeenCalledTimes(1);
  });

  it("refreshes credentials between multipart parts after the original credentials expire", async () => {
    const size = 17 * 1024 * 1024;
    const large = await file("large.bin", Buffer.alloc(size, 7));
    let now = Date.now();
    vi.spyOn(Date, "now").mockImplementation(() => now);
    let mints = 0;
    const parts: { session: string | null; size: number }[] = [];
    let completed = false;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (url.hostname === "blob.upstash.io") return storageCredentials(`session-${++mints}`, now / 1000 + 600);
      if (url.hostname !== "fixture.r2.cloudflarestorage.com") throw new Error("Unexpected host");
      if (url.searchParams.has("uploads")) return new Response("<UploadId>fixture-upload</UploadId>");
      if (url.searchParams.has("partNumber")) {
        expect(init?.body).toBeInstanceOf(Uint8Array);
        parts.push({ session: new Headers(init?.headers).get("x-amz-security-token"), size: (init!.body as Uint8Array).byteLength });
        if (parts.length === 1) now += 11 * 60 * 1000;
        return new Response(null, { headers: { etag: `"part-${parts.length}"` } });
      }
      if (init?.method === "POST" && url.searchParams.has("uploadId")) {
        completed = true;
        expect(new Headers(init.headers).get("x-amz-security-token")).toBe("session-2");
        return new Response('<CompleteMultipartUploadResult><ETag>"complete"</ETag></CompleteMultipartUploadResult>');
      }
      throw new Error(`Unexpected offline request: ${init?.method} ${url.pathname}`);
    });
    await putFile(new Bucket({ token: token(), enableTelemetry: false }), large);
    expect(mints).toBe(2);
    expect(parts[0]!.session).toBe("session-1");
    expect(parts.slice(1).every((part) => part.session === "session-2")).toBe(true);
    expect(parts.reduce((sum, part) => sum + part.size, 0)).toBe(size);
    expect(completed).toBe(true);
  });

  it("aborts a failed multipart upload instead of reporting success", async () => {
    const large = await file("large.bin", Buffer.alloc(17 * 1024 * 1024));
    let aborted = false;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (url.hostname === "blob.upstash.io") return storageCredentials();
      if (url.searchParams.has("uploads")) return new Response("<UploadId>fixture-upload</UploadId>");
      if (init?.method === "DELETE") { aborted = true; return new Response(null, { status: 204 }); }
      return new Response("<Error><Code>AccessDenied</Code></Error>", { status: 403 });
    });
    await expect(putFile(new Bucket({ token: token(), enableTelemetry: false }), large)).rejects.toThrow();
    expect(aborted).toBe(true);
  });
});

describe("cp with the real SDK and offline storage", () => {
  it.each(["environment", "flag"])("uploads with a %s bucket token and no management credentials", async (source) => {
    await writeFile(join(directory, "hello.txt"), "hello");
    const id = randomUUID();
    const bucketToken = token(id);
    process.env.UPSTASH_BLOB_TOKEN = source === "environment" ? bucketToken : token();
    const uploaded: string[] = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (url.hostname === "blob.upstash.io") {
        expect(new Headers(init?.headers).get("authorization")).toBe(`Bearer ${bucketToken}`);
        return storageCredentials();
      }
      if (url.hostname !== "fixture.r2.cloudflarestorage.com") throw new Error("Unexpected host");
      expect(new Headers(init?.headers).get("content-type")).toBe("text/plain");
      expect(init?.method).toBe("PUT");
      expect(await new Response(init?.body).text()).toBe("hello");
      uploaded.push(url.pathname);
      return new Response(null, { headers: { etag: '"hello"' } });
    });
    const flags = source === "flag" ? ["--token", bucketToken] : [];
    const result = await runCommand(await createBlobProgram(), ["blob", "cp", directory, `blob://${id}/assets`, "-r", "-q", ...flags]);
    expect(result).toEqual({ completed: 1, bytes: 5, failed: [], remaining: 0 });
    expect(uploaded).toEqual(["/fixture-bucket/assets/hello.txt"]);
  });

  it("waits for a freshly created bucket, addressed by name, to finish provisioning", async () => {
    await writeFile(join(directory, "hello.txt"), "hello");
    process.env.UPSTASH_EMAIL = "user@example.com";
    process.env.UPSTASH_API_KEY = "api-key";
    const bucketToken = token();
    let mints = 0;
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/v2/blob/bucket")) return Response.json([{ id: "bucket_123", name: "fresh" }]);
      if (url.pathname.endsWith("/v2/blob/bucket/bucket_123")) {
        return Response.json({ id: "bucket_123", name: "fresh", token: bucketToken, creation_time: Date.now() / 1000 });
      }
      if (url.hostname === "blob.upstash.io") {
        if (++mints === 1) return new Response('{"error":"unauthorized"}', { status: 401 });
        return storageCredentials();
      }
      if (url.hostname !== "fixture.r2.cloudflarestorage.com") throw new Error("Unexpected host");
      return new Response(null, { headers: { etag: '"hello"' } });
    });
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    const pending = runCommand(await createBlobProgram(), ["blob", "cp", join(directory, "hello.txt"), "blob://fresh/", "-q"]);
    await vi.waitFor(() => expect(mints).toBe(1));
    await vi.advanceTimersByTimeAsync(3000);
    expect(await pending).toEqual({ completed: 1, bytes: 5, failed: [], remaining: 0 });
    expect(mints).toBeGreaterThan(1);
  });

  it("rejects an empty explicit token instead of falling back to the environment", async () => {
    await writeFile(join(directory, "hello.txt"), "hello");
    const id = randomUUID();
    process.env.UPSTASH_BLOB_TOKEN = token(id);
    await expect(runCommand(await createBlobProgram(), ["blob", "cp", join(directory, "hello.txt"), `blob://${id}/`, "--token", " "]))
      .rejects.toThrow("1 of 1 operations failed");
    await expect(new BucketResolver(new Command(), " ").open(id)).rejects.toThrow("--token must be a non-empty");
    expect(fetch).not.toHaveBeenCalled();
  });
});
