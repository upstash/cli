import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlobProgram, runCommand } from "../helpers/program.js";
import { fetchBlobCredentials } from "../../src/commands/blob/credentials.js";
import { deleteBlobBucket } from "../../src/commands/blob/delete.js";
import { isFreshlyCreated } from "../../src/commands/blob/retry.js";
import { corsOriginProblem } from "../../src/commands/blob/create.js";
import type { BlobBucket, BlobS3Credentials } from "../../src/types.js";

const originalEnv = { ...process.env };

function makeBucket(overrides: Partial<BlobBucket> = {}): BlobBucket {
  return {
    customer_id: "cust_123",
    id: "bucket_123",
    name: "my-bucket",
    hash_for_domain: "hash_123",
    visibility: "private",
    endpoint: "https://bucket_123.example.com",
    pw_version: 1,
    creation_time: 123,
    token: "token_current",
    token_next: "token_next",
    ...overrides,
  };
}

function makeCredentials(overrides: Partial<BlobS3Credentials> = {}): BlobS3Credentials {
  return {
    accessKeyId: "access",
    secretAccessKey: "secret",
    sessionToken: "session",
    endpoint: "https://account.r2.cloudflarestorage.com",
    bucket: "bucket_123",
    region: "auto",
    expiresAt: 1234567890,
    ...overrides,
  };
}

beforeEach(() => {
  process.env = {
    ...originalEnv,
    UPSTASH_EMAIL: "user@example.com",
    UPSTASH_API_KEY: "api-key",
  };
  delete process.env.UPSTASH_BLOB_TOKEN;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  process.env = { ...originalEnv };
});

describe("blob command registration", () => {
  it("registers the expected blob subcommands", async () => {
    const program = await createBlobProgram();
    const blob = program.commands.find((command) => command.name() === "blob");

    expect(blob).toBeDefined();
    expect(blob?.description()).toBe("Manage Blob buckets and objects");
    expect(blob?.commands.map((command) => command.name())).toEqual([
      "create",
      "get",
      "delete",
      "credentials",
      "ls",
      "cp",
      "mv",
      "rm",
      "sync",
      "presign",
      "mb",
      "rb",
    ]);
  });
});

describe("blob CRUD commands", () => {
  it("create defaults to private visibility", async () => {
    const bucket = makeBucket();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(bucket), { status: 200 }),
    );

    const program = await createBlobProgram();
    const result = await runCommand(program, ["blob", "create", "--name", "my-bucket"]);

    expect(result).toEqual(bucket);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.upstash.com/v2/blob/bucket");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      name: "my-bucket",
      visibility: "private",
    });
  });

  it("create passes CORS origins correctly", async () => {
    const bucket = makeBucket({ cors: ["https://a.example.com", "https://b.example.com"] });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(bucket), { status: 200 }),
    );

    const program = await createBlobProgram();
    await runCommand(program, [
      "blob",
      "create",
      "--name",
      "my-bucket",
      "--cors",
      "https://a.example.com",
      "https://b.example.com",
    ]);

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      name: "my-bucket",
      visibility: "private",
      cors: ["https://a.example.com", "https://b.example.com"],
    });
  });

  it("list uses the expected method and path", async () => {
    const buckets = [makeBucket({ token: undefined, token_next: undefined })];
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(buckets), { status: 200 }),
    );

    const program = await createBlobProgram();
    const result = await runCommand(program, ["blob", "list"]);

    expect(result).toEqual(buckets);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.upstash.com/v2/blob/bucket");
    expect(init.method).toBe("GET");
  });

  it("get preserves credentials by default", async () => {
    const bucket = makeBucket();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(bucket), { status: 200 }),
    );

    const program = await createBlobProgram();
    const result = await runCommand(program, ["blob", "get", "--bucket-id", "bucket_123"]);

    expect(result).toEqual(bucket);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.upstash.com/v2/blob/bucket/bucket_123");
    expect(init.method).toBe("GET");
  });

  it("get --hide-credentials removes both token fields without mutating the response", async () => {
    const bucket = makeBucket();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(bucket), { status: 200 }),
    );

    const program = await createBlobProgram();
    const result = await runCommand(program, [
      "blob",
      "get",
      "--bucket-id",
      "bucket_123",
      "--hide-credentials",
    ]);

    expect(result).toEqual({
      customer_id: "cust_123",
      id: "bucket_123",
      name: "my-bucket",
      hash_for_domain: "hash_123",
      visibility: "private",
      endpoint: "https://bucket_123.example.com",
      pw_version: 1,
      creation_time: 123,
    });
    expect(bucket.token).toBe("token_current");
    expect(bucket.token_next).toBe("token_next");
  });

  it("delete dry-run makes no HTTP request and returns the preview shape", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const program = await createBlobProgram();
    const result = await runCommand(program, [
      "blob",
      "delete",
      "--bucket-id",
      "bucket_123",
      "--dry-run",
    ]);

    expect(result).toEqual({ action: "delete", bucket_id: "bucket_123", dry_run: true });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("delete uses the expected method and path", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response('"OK"', { status: 200 }),
    );

    const program = await createBlobProgram();
    const result = await runCommand(program, ["blob", "delete", "--bucket-id", "bucket_123"]);

    expect(result).toEqual({ deleted: true, bucket_id: "bucket_123" });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.upstash.com/v2/blob/bucket/bucket_123");
    expect(init.method).toBe("DELETE");
  });
});

describe("bucket arguments", () => {
  const listed = (): Response => new Response(JSON.stringify([
    makeBucket({ id: "bucket_other", name: "other", token: undefined, token_next: undefined }),
    makeBucket({ token: undefined, token_next: undefined }),
  ]), { status: 200 });

  it("ls lists buckets, and list is the same command", async () => {
    const buckets = [makeBucket({ token: undefined, token_next: undefined })];
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify(buckets), { status: 200 }));
    expect(await runCommand(await createBlobProgram(), ["blob", "ls"])).toEqual(buckets);
    expect(await runCommand(await createBlobProgram(), ["blob", "list"])).toEqual(buckets);
  });

  it.each([["my-bucket"], ["blob://my-bucket"], ["bucket_123"], ["my-bucket/"]])("get %s looks the bucket up by name or id", async (name) => {
    const bucket = makeBucket();
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(listed())
      .mockResolvedValueOnce(new Response(JSON.stringify(bucket), { status: 200 }));
    expect(await runCommand(await createBlobProgram(), ["blob", "get", name])).toEqual(bucket);
    expect(fetchSpy.mock.calls[1]?.[0]).toBe("https://api.upstash.com/v2/blob/bucket/bucket_123");
  });

  it("delete by name deletes that bucket's id", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(listed())
      .mockResolvedValueOnce(new Response('"OK"', { status: 200 }));
    expect(await runCommand(await createBlobProgram(), ["blob", "delete", "my-bucket"])).toEqual({ deleted: true, bucket_id: "bucket_123" });
    expect(fetchSpy.mock.calls[1]?.[0]).toBe("https://api.upstash.com/v2/blob/bucket/bucket_123");
    expect((fetchSpy.mock.calls[1]?.[1] as RequestInit).method).toBe("DELETE");
  });

  it("credentials by name exchanges that bucket's token", async () => {
    const credentials = makeCredentials();
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(listed())
      .mockResolvedValueOnce(new Response(JSON.stringify(makeBucket({ token: "bucket-token" })), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(credentials), { status: 200 }));
    expect(await runCommand(await createBlobProgram(), ["blob", "credentials", "my-bucket"])).toEqual(credentials);
    expect((fetchSpy.mock.calls[2]?.[1] as RequestInit).headers).toEqual({ Authorization: "Bearer bucket-token" });
  });

  it("rejects a missing, unknown, doubled or keyed bucket", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => listed());
    await expect(runCommand(await createBlobProgram(), ["blob", "get"])).rejects.toThrow("Name a bucket: upstash blob get <name-or-id>");
    await expect(runCommand(await createBlobProgram(), ["blob", "delete", "nope"])).rejects.toThrow('Blob bucket "nope" not found');
    await expect(runCommand(await createBlobProgram(), ["blob", "get", "a", "--bucket-id", "b"])).rejects.toThrow("Name the bucket once");
    await expect(runCommand(await createBlobProgram(), ["blob", "delete", "my-bucket/key"])).rejects.toThrow("includes a key");
    fetchSpy.mockClear();
    await expect(runCommand(await createBlobProgram(), ["blob", "credentials", "my-bucket", "--token", "t"]))
      .rejects.toThrow("Use either --token or a bucket");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("blob credentials command", () => {
  it("by bucket id fetches the bucket first, then exchanges its token", async () => {
    const bucket = makeBucket({ id: "bucket_456", token: "bucket-token" });
    const credentials = makeCredentials({ bucket: "bucket_456" });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(bucket), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(credentials), { status: 200 }));

    const program = await createBlobProgram();
    const result = await runCommand(program, [
      "blob",
      "credentials",
      "--bucket-id",
      "bucket_456",
    ]);

    expect(result).toEqual(credentials);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe("https://api.upstash.com/v2/blob/bucket/bucket_456");
    expect(fetchSpy.mock.calls[1]?.[0]).toBe("https://blob.upstash.io/v1/credentials");
    expect((fetchSpy.mock.calls[1]?.[1] as RequestInit).headers).toEqual({
      Authorization: "Bearer bucket-token",
    });
  });

  it.each(["environment", "flag"])("uses the %s token and skips Developer API auth", async (source) => {
    delete process.env.UPSTASH_EMAIL;
    delete process.env.UPSTASH_API_KEY;
    process.env.UPSTASH_BLOB_TOKEN = "env-bucket-token";
    const credentials = makeCredentials();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(credentials), { status: 200 }),
    );

    const program = await createBlobProgram();
    const flags = source === "flag" ? ["--token", "flag-bucket-token"] : [];
    const result = await runCommand(program, ["blob", "credentials", ...flags]);

    expect(result).toEqual(credentials);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe("https://blob.upstash.io/v1/credentials");
    expect((fetchSpy.mock.calls[0]?.[1] as RequestInit).headers).toEqual({
      Authorization: `Bearer ${source === "flag" ? "flag-bucket-token" : "env-bucket-token"}`,
    });
  });

  it("explicit bucket id wins over an ambient UPSTASH_BLOB_TOKEN", async () => {
    process.env.UPSTASH_BLOB_TOKEN = "ambient-token";
    const bucket = makeBucket({ id: "bucket_789", token: "fresh-token" });
    const credentials = makeCredentials({ bucket: "bucket_789" });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(bucket), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(credentials), { status: 200 }));

    const program = await createBlobProgram();
    await runCommand(program, ["blob", "credentials", "--bucket-id", "bucket_789"]);

    expect((fetchSpy.mock.calls[1]?.[1] as RequestInit).headers).toEqual({
      Authorization: "Bearer fresh-token",
    });
  });

  it("fails clearly when no bucket token source is available", async () => {
    delete process.env.UPSTASH_BLOB_TOKEN;
    delete process.env.UPSTASH_EMAIL;
    delete process.env.UPSTASH_API_KEY;

    const program = await createBlobProgram();

    await expect(runCommand(program, ["blob", "credentials"]))
      .rejects.toThrow(/Name a bucket.*--token.*UPSTASH_BLOB_TOKEN/);
  });

  it("prints successful credential responses unchanged", async () => {
    process.env.UPSTASH_BLOB_TOKEN = "env-bucket-token";
    const credentials = {
      ...makeCredentials(),
      extra: "preserved",
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(credentials), { status: 200 }),
    );

    const program = await createBlobProgram();
    const result = await runCommand(program, ["blob", "credentials"]);

    expect(result).toEqual(credentials);
  });

  it("rejects invalid credential payloads and unexpected endpoints", async () => {
    const invalidPayloads = [
      makeCredentials({ accessKeyId: "" }),
      { ...makeCredentials(), expiresAt: Number.NaN },
      makeCredentials({ endpoint: "http://account.r2.cloudflarestorage.com" }),
      makeCredentials({ endpoint: "https://example.com" }),
    ];

    const fetchSpy = vi.spyOn(globalThis, "fetch");
    for (const payload of invalidPayloads) {
      process.env.UPSTASH_BLOB_TOKEN = "env-bucket-token";
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 200 }));
      const program = await createBlobProgram();
      await expect(runCommand(program, ["blob", "credentials"]))
        .rejects.toThrow(/Blob credentials response|Blob credentials endpoint/);
    }
  });

  it("reports 401 as rejected authentication", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response('{"error":"unauthorized"}', { status: 401 }),
    );

    await expect(
      fetchBlobCredentials("bad-token", async () => {
        throw new Error("should not sleep");
      }),
    ).rejects.toThrow(/rejected/);
  });

  it("401 hint mentions provisioning when no retries were allowed", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response('{"error":"unauthorized"}', { status: 401 }),
    );

    await expect(fetchBlobCredentials("token", async () => {})).rejects.toThrow(
      /still be provisioning/,
    );
  });

  it("retries 401 while a fresh bucket is provisioning, then succeeds", async () => {
    const credentials = makeCredentials();
    const delays: number[] = [];
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response('{"error":"unauthorized"}', { status: 401 }))
      .mockResolvedValueOnce(new Response('{"error":"unauthorized"}', { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(credentials), { status: 200 }));

    const result = await fetchBlobCredentials(
      "bucket-token",
      async (ms) => {
        delays.push(ms);
      },
      { unauthorizedRetries: 10 },
    );

    expect(result).toEqual(credentials);
    expect(delays).toEqual([3000, 3000]);
  });

  it("gives up on 401 after the provisioning retry budget and says how long it waited", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response('{"error":"unauthorized"}', { status: 401 }),
    );

    await expect(
      fetchBlobCredentials("bucket-token", async () => {}, { unauthorizedRetries: 2 }),
    ).rejects.toThrow(/rejected after waiting 6s/);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("401 retries do not consume the throttle retry budget", async () => {
    const credentials = makeCredentials();
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(credentials), { status: 200 }));

    const result = await fetchBlobCredentials("t", async () => {}, { unauthorizedRetries: 2 });
    expect(result).toEqual(credentials);
  });

  it("by bucket id does not retry 401 for a bucket that is not freshly created", async () => {
    const bucket = makeBucket({ creation_time: 1 });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(bucket), { status: 200 }))
      .mockResolvedValue(new Response('{"error":"unauthorized"}', { status: 401 }));

    const program = await createBlobProgram();
    await expect(
      runCommand(program, ["blob", "credentials", "--bucket-id", "bucket_123"]),
    ).rejects.toThrow(/rejected/);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("by bucket id polls 401 for a freshly created bucket", async () => {
    vi.useFakeTimers();
    const bucket = makeBucket({ creation_time: Math.floor(Date.now() / 1000) });
    const credentials = makeCredentials();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(bucket), { status: 200 }))
      .mockResolvedValueOnce(new Response('{"error":"unauthorized"}', { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(credentials), { status: 200 }));

    const program = await createBlobProgram();
    const pending = runCommand(program, ["blob", "credentials", "--bucket-id", "bucket_123"]);
    await vi.advanceTimersByTimeAsync(3000);

    expect(await pending).toEqual(credentials);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("retries 429 and 503 with retry-after or fallback delays, then succeeds", async () => {
    const credentials = makeCredentials();
    const delays: number[] = [];
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response('{"error":"slow down"}', { status: 429, headers: { "Retry-After": "1" } }))
      .mockResolvedValueOnce(new Response('{"error":"unavailable"}', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(credentials), { status: 200 }));

    const result = await fetchBlobCredentials("bucket-token", async (ms) => {
      delays.push(ms);
    });

    expect(result).toEqual(credentials);
    expect(delays).toEqual([1000, 2000]);
  });

  it("caps retries and surfaces the final response error", async () => {
    const delays: number[] = [];
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response('{"error":"busy-1"}', { status: 429, headers: { "Retry-After": "999" } }))
      .mockResolvedValueOnce(new Response('{"error":"busy-2"}', { status: 503, headers: { "Retry-After": "nope" } }))
      .mockResolvedValueOnce(new Response('{"error":"busy-3"}', { status: 429, headers: { "Retry-After": "3" } }))
      .mockResolvedValueOnce(new Response('{"error":"still busy"}', { status: 503 }));

    await expect(
      fetchBlobCredentials("bucket-token", async (ms) => {
        delays.push(ms);
      }),
    ).rejects.toThrow(/still busy/);
    expect(delays).toEqual([10000, 2000, 3000]);
  });
});

describe("blob provisioning helpers", () => {
  it("treats missing or recent creation times as freshly created", () => {
    expect(isFreshlyCreated(undefined)).toBe(true);
    expect(isFreshlyCreated(1000, 1000 + 60)).toBe(true);
    expect(isFreshlyCreated(1000, 1000 + 5 * 60)).toBe(false);
  });
});

describe("blob delete retries", () => {
  const auth = { email: "user@example.com", apiKey: "api-key" };

  it("retries 5xx while the bucket is provisioning, then succeeds", async () => {
    const delays: number[] = [];
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response('{"error":"internal"}', { status: 500 }))
      .mockResolvedValueOnce(new Response('"OK"', { status: 200 }));

    await deleteBlobBucket(auth, "bucket_123", async (ms) => {
      delays.push(ms);
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(delays).toEqual([3000]);
  });

  it("treats a 404 after a failed attempt as already deleted", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response('{"error":"internal"}', { status: 500 }))
      .mockResolvedValueOnce(new Response('{"error":"resource not found"}', { status: 404 }));

    await expect(deleteBlobBucket(auth, "bucket_123", async () => {})).resolves.toBeUndefined();
  });

  it("does not retry a first-attempt 404 or any 4xx", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response('{"error":"resource not found"}', { status: 404 }));
    await expect(deleteBlobBucket(auth, "bucket_123", async () => {})).rejects.toThrow(/not found/);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    fetchSpy.mockResolvedValueOnce(new Response('{"error":"bad"}', { status: 400 }));
    await expect(deleteBlobBucket(auth, "bucket_123", async () => {})).rejects.toThrow(/bad/);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("gives up after the 5xx retry budget", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      new Response('{"error":"internal"}', { status: 500 }),
    );
    await expect(deleteBlobBucket(auth, "bucket_123", async () => {})).rejects.toThrow(/internal/);
    expect(fetchSpy).toHaveBeenCalledTimes(6);
  });

  it("delete command surfaces the retried result", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response('{"error":"internal"}', { status: 500 }))
      .mockResolvedValueOnce(new Response('"OK"', { status: 200 }));

    const program = await createBlobProgram();
    const pending = runCommand(program, ["blob", "delete", "--bucket-id", "bucket_123"]);
    await vi.advanceTimersByTimeAsync(3000);

    expect(await pending).toEqual({ deleted: true, bucket_id: "bucket_123" });
  });
});

describe("--env-file", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "upstash-env-file-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const tokenless = () => {
    const { token: _t, token_next: _n, ...rest } = makeBucket();
    return rest;
  };
  const mode = async (path: string) => (await stat(path)).mode & 0o777;

  it("create writes a new file with mode 600 and prints the bucket without tokens", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(makeBucket()), { status: 200 }));
    const path = join(dir, ".env.local");

    const result = await runCommand(await createBlobProgram(), ["blob", "create", "--name", "my-bucket", "--env-file", path]);

    expect(result).toEqual(tokenless());
    expect(JSON.stringify(result)).not.toContain("token_");
    expect(await readFile(path, "utf8")).toBe("UPSTASH_BLOB_TOKEN=token_current\n");
    expect(await mode(path)).toBe(0o600);
  });

  it("get replaces an existing token line, keeps the rest, and narrows the mode", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(makeBucket()), { status: 200 }));
    const path = join(dir, ".env.local");
    await writeFile(path, "# app\nDATABASE_URL=postgres://x\nexport UPSTASH_BLOB_TOKEN=old\nOTHER=1\n# UPSTASH_BLOB_TOKEN=commented\n", { mode: 0o644 });

    const result = await runCommand(await createBlobProgram(), ["blob", "get", "--bucket-id", "bucket_123", "--env-file", path]);

    expect(result).toEqual(tokenless());
    expect(await readFile(path, "utf8")).toBe(
      "# app\nDATABASE_URL=postgres://x\nexport UPSTASH_BLOB_TOKEN=token_current\nOTHER=1\n# UPSTASH_BLOB_TOKEN=commented\n",
    );
    expect(await mode(path)).toBe(0o600);
  });

  it("appends to a file that has no token line and no trailing newline", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(makeBucket()), { status: 200 }));
    const path = join(dir, ".env");
    await writeFile(path, "A=1\r\nB=2");

    await runCommand(await createBlobProgram(), ["blob", "get", "--bucket-id", "bucket_123", "--env-file", path]);

    expect(await readFile(path, "utf8")).toBe("A=1\r\nB=2\r\nUPSTASH_BLOB_TOKEN=token_current\r\n");
  });

  it("create refuses a target directory that does not exist before creating anything", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(
      runCommand(await createBlobProgram(), ["blob", "create", "--name", "my-bucket", "--env-file", join(dir, "missing", ".env")]),
    ).rejects.toThrow(/does not exist/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("create refuses an empty path or a read-only file before creating anything", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const readOnly = join(dir, ".env");
    await writeFile(readOnly, "A=1\n", { mode: 0o400 });
    for (const [path, message] of [["", /needs a path/], [readOnly, /not writable/]] as const) {
      await expect(
        runCommand(await createBlobProgram(), ["blob", "create", "--name", "my-bucket", "--env-file", path]),
      ).rejects.toThrow(message);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("refuses a response without a token and leaves the file alone", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(makeBucket({ token: undefined, token_next: undefined })), { status: 200 }),
    );
    const path = join(dir, ".env");
    await writeFile(path, "A=1\n");
    await expect(
      runCommand(await createBlobProgram(), ["blob", "get", "--bucket-id", "bucket_123", "--env-file", path]),
    ).rejects.toThrow(/no token/);
    expect(await readFile(path, "utf8")).toBe("A=1\n");
  });

  it("is advertised in create and get help", async () => {
    const program = await createBlobProgram();
    const blob = program.commands.find((c) => c.name() === "blob")!;
    for (const name of ["create", "get"]) {
      const help = blob.commands.find((c) => c.name() === name)!.helpInformation();
      expect(help).toContain("--env-file <path>");
      expect(help).toContain("UPSTASH_BLOB_TOKEN");
    }
  });
});

describe("--cors validation", () => {
  it.each([
    ["", undefined],
    ["localhost:3000", "http://localhost:3000"],
    ["app.example.com", "https://app.example.com"],
    ["http://localhost:3000/", "http://localhost:3000"],
    ["https://app.example.com/upload", "https://app.example.com"],
    ["HTTPS://App.Example.com", "https://app.example.com"],
    ["https://a.com,https://b.com", undefined],
    ["capacitor://localhost", undefined],
  ])("rejects %j", (value, guess) => {
    const problem = corsOriginProblem(value);
    expect(problem).toContain(`${JSON.stringify(value)} is not a valid origin`);
    if (guess) expect(problem).toContain(`did you mean ${guess}?`);
  });

  it.each(["*", "http://localhost:3000", "https://app.example.com", "https://*.example.com", "http://127.0.0.1:8080", "http://intranet:8080"])(
    "accepts %j",
    (value) => {
      expect(corsOriginProblem(value)).toBeUndefined();
    },
  );

  for (const command of [["create", "--name", "my-bucket"], ["mb", "blob://my-bucket"]]) {
    it(`${command[0]} refuses an empty origin before calling the API`, async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
      await expect(runCommand(await createBlobProgram(), ["blob", ...command, "--cors", ""])).rejects.toThrow(/is not a valid origin/);
      expect(fetchSpy).not.toHaveBeenCalled();
      stderr.mockRestore();
    });
  }

  it("create help says omitting --cors allows all origins", async () => {
    const program = await createBlobProgram();
    const blob = program.commands.find((c) => c.name() === "blob")!;
    const help = blob.commands.find((c) => c.name() === "create")!.helpInformation().replace(/\s+/g, " ");
    expect(help).toContain("Omit --cors to allow all origins (*)");
  });
});
