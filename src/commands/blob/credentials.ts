import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { HttpError, request } from "../../client.js";
import { printJSON } from "../../output.js";
import type { BlobBucket, BlobS3Credentials } from "../../types.js";

const BLOB_CREDENTIALS_URL = "https://blob.upstash.io/v1/credentials";
const RETRYABLE_STATUSES = new Set([429, 503]);
const DEFAULT_RETRY_DELAY_MS = 2000;
const MAX_RETRY_DELAY_MS = 10000;
const MAX_RETRIES = 3;

type Sleep = (ms: number) => Promise<void>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseErrorMessage(text: string, status: number): string {
  let message = text || `HTTP ${status}`;
  try {
    const parsed = JSON.parse(text) as { error?: unknown; message?: unknown };
    const candidate = parsed.error ?? parsed.message;
    if (typeof candidate === "string" && candidate.length > 0) {
      message = candidate;
    }
  } catch {
    // keep original message
  }
  return message;
}

function getRetryDelayMs(retryAfter: string | null): number {
  const parsed = Number(retryAfter);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_RETRY_DELAY_MS;
  }
  return Math.min(parsed * 1000, MAX_RETRY_DELAY_MS);
}

function validateCredentials(data: unknown): BlobS3Credentials {
  if (!data || typeof data !== "object") {
    throw new Error("Blob credentials response must be a JSON object");
  }

  const credentials = data as Record<string, unknown>;
  const requiredStrings = [
    "accessKeyId",
    "secretAccessKey",
    "sessionToken",
    "endpoint",
    "bucket",
    "region",
  ] as const;

  for (const field of requiredStrings) {
    if (typeof credentials[field] !== "string" || credentials[field].length === 0) {
      throw new Error(`Blob credentials response is missing a valid ${field}`);
    }
  }

  if (typeof credentials.expiresAt !== "number" || !Number.isFinite(credentials.expiresAt)) {
    throw new Error("Blob credentials response is missing a valid expiresAt");
  }

  let endpoint: URL;
  try {
    endpoint = new URL(credentials.endpoint as string);
  } catch {
    throw new Error("Blob credentials response has an invalid endpoint URL");
  }

  if (endpoint.protocol !== "https:") {
    throw new Error("Blob credentials endpoint must use HTTPS");
  }

  if (!endpoint.hostname.endsWith(".r2.cloudflarestorage.com")) {
    throw new Error(
      "Blob credentials endpoint must target a .r2.cloudflarestorage.com hostname",
    );
  }

  return credentials as unknown as BlobS3Credentials;
}

export async function fetchBlobCredentials(
  token: string,
  pause: Sleep = sleep,
): Promise<BlobS3Credentials> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const response = await fetch(BLOB_CREDENTIALS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const text = await response.text();

    if (response.ok) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        throw new Error("Blob credentials response must be valid JSON");
      }
      return validateCredentials(parsed);
    }

    if (response.status === 401) {
      throw new HttpError("Blob bucket token was rejected", response.status);
    }

    if (RETRYABLE_STATUSES.has(response.status) && attempt < MAX_RETRIES) {
      await pause(getRetryDelayMs(response.headers.get("Retry-After")));
      continue;
    }

    throw new HttpError(parseErrorMessage(text, response.status), response.status);
  }

  throw new Error("Blob credentials request failed after retries");
}

function resolveBucketToken(flags: { bucketId?: string }, command: Command): Promise<string> {
  if (flags.bucketId) {
    const auth = resolveAuth(command);
    return request<BlobBucket>(auth, "GET", `/v2/blob/bucket/${flags.bucketId}`).then((bucket) => {
      if (typeof bucket.token === "string" && bucket.token.length > 0) {
        return bucket.token;
      }
      throw new Error(`Blob bucket ${flags.bucketId} did not return a current token`);
    });
  }

  const token = process.env.UPSTASH_BLOB_TOKEN;
  if (typeof token === "string" && token.length > 0) {
    return Promise.resolve(token);
  }

  return Promise.reject(
    new Error(
      "Blob credentials require either --bucket-id with Upstash account authentication or a non-empty UPSTASH_BLOB_TOKEN environment variable",
    ),
  );
}

export function registerBlobCredentials(blob: Command): void {
  blob
    .command("credentials")
    .description(
      "Get temporary S3 credentials for a Blob bucket; expiresAt is the credential expiry",
    )
    .option("--bucket-id <id>", "Blob bucket ID")
    .action(async (flags: { bucketId?: string }, command: Command) => {
      const token = await resolveBucketToken(flags, command);
      const credentials = await fetchBlobCredentials(token);
      printJSON(credentials);
    });
}
