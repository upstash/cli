import { constants } from "node:fs";
import { access, chmod, readFile, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { BlobBucket } from "../../types.js";

export const BLOB_TOKEN_ENV = "UPSTASH_BLOB_TOKEN";

export const ENV_FILE_HELP =
  `Write the bucket token to this env file as ${BLOB_TOKEN_ENV} (e.g. .env.local), ` +
  "and print the bucket without its tokens. The file is created if missing, an existing " +
  `${BLOB_TOKEN_ENV} line is replaced, other lines are kept, and the mode is set to 600`;

/** Fails before a bucket is created when the token would have nowhere to go. */
export async function checkEnvFileTarget(path: string): Promise<void> {
  if (path.trim() === "") throw new Error("--env-file needs a path, e.g. --env-file .env.local");
  const existing = await stat(path).catch(() => undefined);
  if (existing?.isDirectory()) throw new Error(`--env-file: ${path} is a directory`);
  const target = existing ? path : dirname(path);
  if (!existing) {
    const dir = await stat(target).catch(() => undefined);
    if (!dir?.isDirectory()) throw new Error(`--env-file: directory ${target} does not exist`);
  }
  await access(target, constants.W_OK).catch(() => {
    throw new Error(`--env-file: ${target} is not writable`);
  });
}

/**
 * Sets NAME=value in a dotenv file: every existing NAME line (with or without `export`) is
 * rewritten in place, otherwise one line is appended. Everything else is kept byte for byte.
 */
export async function writeEnvVar(path: string, name: string, value: string): Promise<void> {
  await checkEnvFileTarget(path);
  let content = "";
  let exists = true;
  try {
    content = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    exists = false;
  }
  const eol = content.includes("\r\n") ? "\r\n" : "\n";
  const line = new RegExp(`^(\\s*)(export\\s+)?${name}\\s*=.*$`);
  const encoded = /^[\w.+/=:-]*$/.test(value) ? value : JSON.stringify(value);
  let found = false;
  const lines = content.split(/\r?\n/).map((text) => {
    const match = line.exec(text);
    if (!match) return text;
    found = true;
    return `${match[1]}${match[2] ?? ""}${name}=${encoded}`;
  });
  let next = lines.join(eol);
  if (!found) {
    if (next.length > 0 && !next.endsWith(eol)) next += eol;
    next += `${name}=${encoded}${eol}`;
  }
  // Narrowed before the token is written, so an existing world-readable file never holds it.
  if (exists) await chmod(path, 0o600);
  await writeFile(path, next, { mode: 0o600 });
  await chmod(path, 0o600);
}

/** Writes the bucket's token to the env file and returns what is safe to print. */
export async function saveBucketToken(bucket: BlobBucket, path: string): Promise<Omit<BlobBucket, "token" | "token_next">> {
  const { token, token_next: _tokenNext, ...rest } = bucket;
  if (!token) throw new Error(`--env-file: the response carried no token, so ${path} was not changed`);
  await writeEnvVar(path, BLOB_TOKEN_ENV, token);
  console.error(`Wrote ${BLOB_TOKEN_ENV} to ${path}`);
  return rest;
}
