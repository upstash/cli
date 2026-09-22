import { Bucket, BlobError } from "@upstash/blob";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { planUpload, uploadFiles } from "../../src/commands/blob/upload.js";
import { createBlobProgram, runCommand } from "../helpers/program.js";

let directory: string;
const originalEnv = { ...process.env };

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "blob-upload-test-"));
  delete process.env.UPSTASH_BLOB_TOKEN;
  delete process.env.UPSTASH_EMAIL;
  delete process.env.UPSTASH_API_KEY;
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Unexpected network request in offline test"));
});

afterEach(async () => {
  vi.restoreAllMocks();
  process.env = { ...originalEnv };
  await rm(directory, { recursive: true, force: true });
});

function token(): string {
  const id = Buffer.from(randomUUID());
  const password = Buffer.from("fixture-password");
  const hash = Buffer.from("fixture");
  return Buffer.concat([Buffer.from([2, 0, id.length, 0, password.length, hash.length]), id, password, hash]).toString("base64url");
}

async function consume(body: Parameters<Bucket["put"]>[1]): Promise<void> {
  if (!(body instanceof ReadableStream)) throw new Error("expected a stream");
  const reader = body.getReader();
  while (!(await reader.read()).done) { /* drain the fixture stream */ }
}

describe("upload planning", () => {
  it("preserves nested paths and MIME types while skipping symlinks and empty folders", async () => {
    await mkdir(join(directory, "images"));
    await mkdir(join(directory, "empty"));
    await writeFile(join(directory, "images", "photo.png"), "png");
    await writeFile(join(directory, "app.css"), "body {}");
    await symlink(join(directory, "images"), join(directory, "linked"));
    const files = await planUpload(directory, "/assets/");
    expect(files.map(({ path, contentType }) => ({ path, contentType })).sort((a, b) => a.path.localeCompare(b.path))).toEqual([
      { path: "assets/app.css", contentType: "text/css" },
      { path: "assets/images/photo.png", contentType: "image/png" },
    ]);
  });

  it("accepts a single file and rejects a symlink source", async () => {
    const file = join(directory, "one.txt");
    await writeFile(file, "hello");
    expect(await planUpload(file, "docs")).toEqual([
      { source: file, path: "docs/one.txt", size: 5, contentType: "text/plain" },
    ]);
    await symlink(file, join(directory, "link"));
    await expect(planUpload(join(directory, "link"), "")).rejects.toThrow("symbolic links");
  });

  it("rejects unsafe prefixes before authentication", async () => {
    for (const prefix of ["../outside", "assets/../secret", "a\\b", "a\nb"]) {
      await expect(planUpload(directory, prefix)).rejects.toThrow("prefix");
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("dry-run works without credentials or network requests", async () => {
    await writeFile(join(directory, "file.txt"), "hello");
    const result = await runCommand(await createBlobProgram(), ["blob", "upload", directory, "--prefix", "assets", "--dry-run"]);
    expect(result).toMatchObject({ dry_run: true, bytes: 5, files: [{ path: "assets/file.txt" }] });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("validates concurrency before authentication", async () => {
    const program = await createBlobProgram();
    program.configureOutput({ writeErr: () => {} });
    await expect(runCommand(program, ["blob", "upload", directory, "--concurrency", "0"])).rejects.toThrow("concurrency");
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("upload scheduling", () => {
  it("streams bytes, respects concurrency, and reports confirmed uploads", async () => {
    for (let i = 0; i < 6; i++) await writeFile(join(directory, `${i}.txt`), "hello");
    let active = 0;
    let maximum = 0;
    const bucket = {
      exists: vi.fn(),
      put: vi.fn(async (_path, body) => {
        active++;
        maximum = Math.max(maximum, active);
        await consume(body);
        active--;
        return {};
      }),
    } as unknown as Pick<Bucket, "put" | "exists">;
    const summary = await uploadFiles(bucket, await planUpload(directory, ""), { concurrency: 2 }, () => {});
    expect(summary).toEqual({ uploaded: 6, skipped: 0, bytes: 30, failed: [], remaining: 0 });
    expect(maximum).toBeLessThanOrEqual(2);
    expect(bucket.exists).not.toHaveBeenCalled();
  });

  it("skip-existing does not open or overwrite existing objects", async () => {
    const file = join(directory, "file.txt");
    await writeFile(file, "hello");
    const files = await planUpload(directory, "");
    await rm(file);
    const bucket = { exists: vi.fn().mockResolvedValue(true), put: vi.fn() };
    expect(await uploadFiles(bucket, files, { concurrency: 1, skipExisting: true }, () => {})).toEqual({
      uploaded: 0, skipped: 1, bytes: 0, failed: [], remaining: 0,
    });
    expect(bucket.put).not.toHaveBeenCalled();
  });

  it("reports failures and stops scheduling remaining files", async () => {
    await writeFile(join(directory, "a.txt"), "hello");
    await writeFile(join(directory, "b.txt"), "hello");
    const files = await planUpload(directory, "");
    const bucket = { exists: vi.fn(), put: vi.fn().mockRejectedValue(new BlobError("unauthorized")) };
    const summary = await uploadFiles(bucket, files, { concurrency: 1 }, () => {});
    expect(summary).toMatchObject({ uploaded: 0, remaining: 1, failed: [{ path: files[0]!.path }] });
    expect(bucket.put).toHaveBeenCalledTimes(1);
  });

  it("reopens a stream when retrying a transient failure", async () => {
    await writeFile(join(directory, "file.txt"), "hello");
    let attempts = 0;
    const bodies: unknown[] = [];
    const bucket = {
      exists: vi.fn(),
      put: vi.fn(async (_path, body) => {
        bodies.push(body);
        await consume(body);
        if (++attempts === 1) throw new BlobError("request_failed", { status: 503 });
        return {};
      }),
    } as unknown as Pick<Bucket, "put" | "exists">;
    const summary = await uploadFiles(bucket, await planUpload(directory, ""), { concurrency: 1 }, () => {});
    expect(summary.uploaded).toBe(1);
    expect(attempts).toBe(2);
    expect(bodies[0]).not.toBe(bodies[1]);
  });

  it("does not start work after cancellation", async () => {
    await writeFile(join(directory, "file.txt"), "hello");
    const controller = new AbortController();
    controller.abort();
    const bucket = { exists: vi.fn(), put: vi.fn() };
    const summary = await uploadFiles(bucket, await planUpload(directory, ""), { concurrency: 1 }, () => {}, controller.signal);
    expect(summary.remaining).toBe(1);
    expect(bucket.put).not.toHaveBeenCalled();
  });
});

describe("real SDK with offline storage transport", () => {
  it.each(["environment", "flag"])("uploads with a %s bucket token and no management credentials", async (source) => {
    await writeFile(join(directory, "hello.txt"), "hello");
    const bucketToken = token();
    process.env.UPSTASH_BLOB_TOKEN = source === "environment" ? bucketToken : "ignored-ambient-token";
    const uploaded: string[] = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (url.hostname === "blob.upstash.io") {
        expect(new Headers(init?.headers).get("authorization")).toBe(`Bearer ${bucketToken}`);
        return Response.json({
          accessKeyId: "key", secretAccessKey: "secret", sessionToken: "session", expiresAt: Date.now() / 1000 + 600,
          endpoint: "https://fixture.r2.cloudflarestorage.com", bucket: "fixture-bucket", region: "auto",
        });
      }
      if (url.hostname !== "fixture.r2.cloudflarestorage.com") throw new Error("Unexpected host");
      expect(new Headers(init?.headers).get("content-type")).toBe("text/plain");
      expect(init?.method).toBe("PUT");
      expect(await new Response(init?.body).text()).toBe("hello");
      uploaded.push(url.pathname);
      return new Response(null, { headers: { etag: '"hello"' } });
    });
    const flags = source === "flag" ? ["--token", bucketToken] : [];
    const result = await runCommand(await createBlobProgram(), ["blob", "upload", directory, "--prefix", "assets", "--quiet", ...flags]);
    expect(result).toEqual({ uploaded: 1, skipped: 0, bytes: 5, failed: [], remaining: 0 });
    expect(uploaded).toEqual(["/fixture-bucket/assets/hello.txt"]);
  });

  it("rejects an empty explicit token instead of falling back to ambient credentials", async () => {
    await writeFile(join(directory, "hello.txt"), "hello");
    process.env.UPSTASH_BLOB_TOKEN = token();
    await expect(runCommand(await createBlobProgram(), ["blob", "upload", directory, "--token", " "]))
      .rejects.toThrow("--token must be a non-empty");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects conflicting explicit bucket selectors without making a request", async () => {
    await writeFile(join(directory, "hello.txt"), "hello");
    await expect(runCommand(await createBlobProgram(), ["blob", "upload", directory, "--token", token(), "--bucket-id", "another-bucket"]))
      .rejects.toThrow("Use either --token or --bucket-id");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refreshes credentials between multipart parts after the original credentials expire", async () => {
    const file = join(directory, "large.bin");
    const size = 17 * 1024 * 1024;
    await writeFile(file, Buffer.alloc(size, 7));
    let now = Date.now();
    vi.spyOn(Date, "now").mockImplementation(() => now);
    let mints = 0;
    const parts: { session: string | null; size: number }[] = [];
    let completed = false;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (url.hostname === "blob.upstash.io") {
        mints++;
        return Response.json({
          accessKeyId: "fixture-key", secretAccessKey: "fixture-secret",
          sessionToken: `session-${mints}`, expiresAt: now / 1000 + 600,
          endpoint: "https://fixture.r2.cloudflarestorage.com", bucket: "fixture-bucket", region: "auto",
        });
      }
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
    const bucket = new Bucket({ token: token(), enableTelemetry: false });
    const summary = await uploadFiles(bucket, await planUpload(file, ""), { concurrency: 1 }, () => {});
    expect(summary).toEqual({ uploaded: 1, skipped: 0, bytes: size, failed: [], remaining: 0 });
    expect(mints).toBe(2);
    expect(parts[0]!.session).toBe("session-1");
    expect(parts.slice(1).every((part) => part.session === "session-2")).toBe(true);
    expect(parts.reduce((sum, part) => sum + part.size, 0)).toBe(size);
    expect(completed).toBe(true);
  });

  it("aborts a failed multipart upload instead of reporting success", async () => {
    await writeFile(join(directory, "large.bin"), Buffer.alloc(17 * 1024 * 1024));
    let aborted = false;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (url.hostname === "blob.upstash.io") return Response.json({
        accessKeyId: "key", secretAccessKey: "secret", sessionToken: "session", expiresAt: Date.now() / 1000 + 600,
        endpoint: "https://fixture.r2.cloudflarestorage.com", bucket: "fixture-bucket", region: "auto",
      });
      if (url.searchParams.has("uploads")) return new Response("<UploadId>fixture-upload</UploadId>");
      if (init?.method === "DELETE") { aborted = true; return new Response(null, { status: 204 }); }
      return new Response("<Error><Code>AccessDenied</Code></Error>", { status: 403 });
    });
    const summary = await uploadFiles(new Bucket({ token: token(), enableTelemetry: false }), await planUpload(directory, ""), { concurrency: 1 }, () => {});
    expect(summary.uploaded).toBe(0);
    expect(summary.failed).toHaveLength(1);
    expect(aborted).toBe(true);
  });
});
