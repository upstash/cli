import { Bucket } from "@upstash/blob";
import type { Command } from "commander";
import { createHash, createHmac } from "node:crypto";
import { resolveAuth } from "../../auth.js";
import type { Auth } from "../../auth.js";
import { request } from "../../client.js";
import { telemetryStatus } from "../../telemetry.js";
import type { BlobBucket } from "../../types.js";
import { fetchBlobCredentials } from "./credentials.js";
import { isFreshlyCreated, PROVISIONING_MAX_RETRIES, sleep } from "./retry.js";

/** The bucket id a Blob token was issued for, read from the token itself. */
export function tokenBucketId(token: string): string | undefined {
  const raw = Buffer.from(token.trim(), "base64url");
  if (raw.length < 6) return undefined;
  const id = raw.subarray(6, 6 + (raw[2] ?? 0)).toString();
  return id || undefined;
}

export function findAccountBucket(buckets: BlobBucket[], name: string): BlobBucket {
  const match = buckets.find((bucket) => bucket.id === name) ?? buckets.find((bucket) => bucket.name === name);
  if (!match) throw new Error(`Blob bucket "${name}" not found`);
  return match;
}

/**
 * Turns the bucket part of a blob:// URI into a Bucket. A Blob token is used only for the bucket it
 * was issued for, matched by id; anything else is looked up by name or id with account credentials,
 * so a stray UPSTASH_BLOB_TOKEN in .env never redirects a command to another bucket.
 */
export class BucketResolver {
  private readonly buckets = new Map<string, Promise<Bucket>>();
  private accountBuckets?: Promise<BlobBucket[]>;

  constructor(private readonly command: Command, private readonly token?: string) {}

  open(name: string): Promise<Bucket> {
    let bucket = this.buckets.get(name);
    if (!bucket) {
      bucket = this.resolve(name);
      this.buckets.set(name, bucket);
    }
    return bucket;
  }

  auth(): Auth {
    return resolveAuth(this.command);
  }

  listAccountBuckets(): Promise<BlobBucket[]> {
    this.accountBuckets ??= request<BlobBucket[]>(this.auth(), "GET", "/v2/blob/bucket");
    return this.accountBuckets;
  }

  private async resolve(name: string): Promise<Bucket> {
    const tokens = [this.token?.trim(), process.env.UPSTASH_BLOB_TOKEN?.trim()]
      .filter((token): token is string => typeof token === "string" && token.length > 0);
    const direct = tokens.find((token) => tokenBucketId(token) === name);
    if (direct) return this.bucket(direct);

    let auth: Auth;
    try {
      auth = this.auth();
    } catch (error) {
      if (tokens.length === 0) throw error;
      const ids = [...new Set(tokens.map((token) => tokenBucketId(token) ?? "unknown"))];
      throw new Error(
        `The Blob token is for bucket ${ids.join(", ")}, not "${name}". Address that bucket as blob://${ids[0]}/..., or run \`upstash login\` to use bucket names`,
      );
    }
    const match = findAccountBucket(await this.listAccountBuckets(), name);
    const bucket = await request<BlobBucket>(auth, "GET", `/v2/blob/bucket/${match.id}`);
    if (typeof bucket.token !== "string" || bucket.token.length === 0) {
      throw new Error(`Blob bucket ${match.id} did not return a current token`);
    }
    // A bucket created moments ago answers 401 until provisioning finishes.
    if (isFreshlyCreated(bucket.creation_time)) {
      await fetchBlobCredentials(bucket.token, sleep, { unauthorizedRetries: PROVISIONING_MAX_RETRIES });
    }
    return this.bucket(bucket.token);
  }

  private bucket(token: string): Bucket {
    return new Bucket({ token, enableTelemetry: telemetryStatus().enabled });
  }
}

export interface ListedObject {
  key: string;
  size: number;
  last_modified: string;
  etag: string;
}

export interface DirectoryPage {
  prefixes: string[];
  objects: ListedObject[];
  cursor?: string;
}

const sha256 = (data: string): string => createHash("sha256").update(data).digest("hex");
const hmac = (key: string | Buffer, data: string): Buffer => createHmac("sha256", key).update(data).digest();
const uriEncode = (value: string): string =>
  encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);

function decodeEntities(value: string): string {
  return value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&");
}

function tag(xml: string, name: string): string | undefined {
  const match = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(xml);
  return match?.[1] === undefined ? undefined : decodeEntities(match[1]);
}

function blocks(xml: string, name: string): string[] {
  return [...xml.matchAll(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, "g"))].map((match) => match[1] ?? "");
}

/**
 * One page of a delimiter listing: the keys directly under `prefix` and the "folders" below it.
 * The SDK's list() has no delimiter, so this signs its own ListObjectsV2 with the bucket's
 * refreshing S3 credentials.
 */
export async function listDirectory(bucket: Bucket, prefix: string, cursor?: string): Promise<DirectoryPage> {
  const s3 = bucket.s3();
  for (let attempt = 0; ; attempt++) {
    const [{ url: endpoint }, credentials] = await Promise.all([s3.endpoint(), s3.credentials()]);
    const query: Record<string, string> = { delimiter: "/", "list-type": "2" };
    if (prefix) query.prefix = prefix;
    if (cursor) query["continuation-token"] = cursor;
    const canonicalQuery = Object.keys(query).sort()
      .map((key) => `${uriEncode(key)}=${uriEncode(query[key] ?? "")}`).join("&");
    const path = `${endpoint.pathname.replace(/\/+$/, "")}/${uriEncode(s3.bucket)}`;
    const amzDate = new Date().toISOString().replace(/[-:]|\.\d{3}/g, "");
    const date = amzDate.slice(0, 8);
    const payloadHash = sha256("");
    const headers: Record<string, string> = {
      host: endpoint.host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      "x-amz-security-token": credentials.sessionToken,
    };
    const names = Object.keys(headers).sort();
    const canonicalRequest = [
      "GET", path, canonicalQuery, names.map((name) => `${name}:${headers[name]}\n`).join(""), names.join(";"), payloadHash,
    ].join("\n");
    const scope = `${date}/${s3.region}/s3/aws4_request`;
    let key = hmac(`AWS4${credentials.secretAccessKey}`, date);
    for (const part of [s3.region, "s3", "aws4_request"]) key = hmac(key, part);
    const signature = createHmac("sha256", key)
      .update(["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonicalRequest)].join("\n")).digest("hex");
    const { host: _host, ...sent } = headers;

    let response: Response;
    try {
      response = await fetch(`${endpoint.origin}${path}?${canonicalQuery}`, {
        headers: {
          ...sent,
          authorization: `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${scope}, SignedHeaders=${names.join(";")}, Signature=${signature}`,
        },
      });
    } catch (error) {
      if (attempt >= 2) throw error;
      await sleep(500 * 2 ** attempt);
      continue;
    }
    const xml = await response.text();
    if ((response.status === 429 || response.status >= 500) && attempt < 2) {
      await sleep(500 * 2 ** attempt);
      continue;
    }
    if (!response.ok) {
      throw new Error(`listing failed: ${tag(xml, "Message") ?? tag(xml, "Code") ?? `HTTP ${response.status}`}`);
    }
    const next = tag(xml, "NextContinuationToken");
    return {
      prefixes: blocks(xml, "CommonPrefixes").map((block) => tag(block, "Prefix")).filter((value): value is string => value !== undefined),
      objects: blocks(xml, "Contents").flatMap((block) => {
        const objectKey = tag(block, "Key");
        if (objectKey === undefined) return [];
        return [{
          key: objectKey,
          size: Number(tag(block, "Size") ?? 0),
          last_modified: new Date(tag(block, "LastModified") ?? 0).toISOString(),
          etag: tag(block, "ETag") ?? "",
        }];
      }),
      cursor: tag(xml, "IsTruncated") === "true" && next ? next : undefined,
    };
  }
}
