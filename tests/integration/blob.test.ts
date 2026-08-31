import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HttpError } from "../../src/client.js";
import { createBlobProgram, runCommand } from "../helpers/program.js";
import type { BlobBucket, BlobS3Credentials } from "../../src/types.js";

const runIntegration = process.env.RUN_BLOB_INTEGRATION === "1";
const describeBlob = runIntegration ? describe : describe.skip;
const TEST_NAME = `cli-blob-${Date.now()}`;
const DEADLINE_MS = 120000;
const POLL_INTERVAL_MS = 5000;
const TEST_TIMEOUT_MS = DEADLINE_MS + 30000;
const CLEANUP_TIMEOUT_MS = DEADLINE_MS + 30000;

let bucketId: string | undefined;

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForCredentials(id: string): Promise<BlobS3Credentials> {
  const deadline = Date.now() + DEADLINE_MS;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const program = await createBlobProgram();
      return await runCommand(program, ["blob", "credentials", "--bucket-id", id]) as BlobS3Credentials;
    } catch (error) {
      // A fresh coordinator record can exist before the Blob worker has created
      // its matching bucket row. The worker returns 401 during that window, so
      // it is transient only in this bounded create-then-poll integration flow.
      if (error instanceof HttpError && [401, 429, 503].includes(error.status)) {
        lastError = error;
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      throw error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Timed out waiting for Blob credentials to become ready");
}

async function cleanupBucket(id: string): Promise<void> {
  const deadline = Date.now() + DEADLINE_MS;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const program = await createBlobProgram();
      await runCommand(program, ["blob", "delete", "--bucket-id", id]);
      return;
    } catch (error) {
      if (error instanceof HttpError) {
        if (error.status === 404) {
          return;
        }

        if (error.status >= 500 && error.status < 600) {
          lastError = error;
          await sleep(POLL_INTERVAL_MS);
          continue;
        }
      }

      throw error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Timed out deleting Blob bucket ${id}`);
}

beforeAll(async () => {
  if (!runIntegration) return;
  const program = await createBlobProgram();
  const bucket = await runCommand(program, [
    "blob",
    "create",
    "--name",
    TEST_NAME,
    "--visibility",
    "private",
  ]) as BlobBucket;

  expect(bucket.id).toBeDefined();
  bucketId = bucket.id;
});

afterAll(async () => {
  if (!bucketId) return;
  await cleanupBucket(bucketId);
}, CLEANUP_TIMEOUT_MS);

describeBlob("blob integration lifecycle", () => {
  it("lists and gets the created bucket", async () => {
    const listProgram = await createBlobProgram();
    const buckets = await runCommand(listProgram, ["blob", "list"]) as BlobBucket[];
    expect(buckets.some((bucket) => bucket.id === bucketId)).toBe(true);

    const getProgram = await createBlobProgram();
    const bucket = await runCommand(getProgram, ["blob", "get", "--bucket-id", bucketId!]) as BlobBucket;
    expect(bucket.id).toBe(bucketId);
    expect(bucket.name).toBe(TEST_NAME);
    expect(bucket.visibility).toBe("private");
  });

  it("returns temporary S3 credentials once provisioning is ready", async () => {
    const credentials = await waitForCredentials(bucketId!);
    expect(credentials.bucket).toBe(bucketId);
    expect(credentials.region).toBe("auto");
    expect(credentials.endpoint.startsWith("https://")).toBe(true);
    expect(credentials.endpoint.includes(".r2.cloudflarestorage.com")).toBe(true);
    expect(credentials.expiresAt).toBeGreaterThan(Date.now() / 1000);
  }, TEST_TIMEOUT_MS);
});
