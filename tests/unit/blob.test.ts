import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlobProgram, runCommand } from "../helpers/program.js";
import { fetchBlobCredentials } from "../../src/commands/blob/credentials.js";
import { deleteBlobBucket } from "../../src/commands/blob/delete.js";
import { isFreshlyCreated } from "../../src/commands/blob/retry.js";
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
    expect(blob?.description()).toBe("Manage Blob buckets");
    expect(blob?.commands.map((command) => command.name())).toEqual([
      "create",
      "list",
      "get",
      "delete",
      "credentials",
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

  it("without bucket id uses UPSTASH_BLOB_TOKEN and skips Developer API auth", async () => {
    process.env.UPSTASH_BLOB_TOKEN = "env-bucket-token";
    const credentials = makeCredentials();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(credentials), { status: 200 }),
    );

    const program = await createBlobProgram();
    const result = await runCommand(program, ["blob", "credentials"]);

    expect(result).toEqual(credentials);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe("https://blob.upstash.io/v1/credentials");
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
      .rejects.toThrow(/either --bucket-id.*UPSTASH_BLOB_TOKEN/);
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
