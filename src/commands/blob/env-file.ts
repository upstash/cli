import { constants } from "node:fs";
import { access, chmod, lstat, readFile, readlink, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { BlobBucket } from "../../types.js";

export const BLOB_TOKEN_ENV = "UPSTASH_BLOB_TOKEN";

// The flag is --write-env and not --env-file: Node reads --env-file from anywhere in argv, even
// after the script, and exits with "not found" when the file does not exist yet.
export const ENV_FILE_HELP =
  `Write the bucket token to this env file as ${BLOB_TOKEN_ENV} (e.g. .env.local), ` +
  "and print the bucket without its tokens. The file is created if missing, an existing " +
  `${BLOB_TOKEN_ENV} line is replaced, other lines are kept, and the mode is set to 600. ` +
  "Not to be confused with the global --env-path, which reads credentials from a file";

/** Fails before a bucket is created when the token would have nowhere to go. */
export async function checkEnvFileTarget(path: string): Promise<void> {
  if (path.trim() === "") throw new Error("--write-env needs a path, e.g. --write-env .env.local");
  const existing = await stat(path).catch(() => undefined);
  // A link to a file not created yet is fine, as long as the directory it points into exists.
  if (!existing && (await lstat(path).catch(() => undefined))?.isSymbolicLink()) {
    const target = resolve(dirname(path), await readlink(path));
    if (!(await stat(dirname(target)).catch(() => undefined))?.isDirectory()) {
      throw new Error(`--write-env: ${path} is a symlink to a file that cannot be reached`);
    }
  }
  if (existing?.isDirectory() || /[\\/]$/.test(path)) throw new Error(`--write-env: ${path} is a directory`);
  // Only the owner (or root) can narrow the mode to 600, and the token is not written without it.
  if (existing && process.getuid && process.getuid() !== 0 && existing.uid !== process.getuid()) {
    throw new Error(`--write-env: ${path} belongs to another user, so its mode cannot be set to 600`);
  }
  const target = existing ? path : dirname(path);
  if (!existing) {
    const dir = await stat(target).catch(() => undefined);
    if (!dir?.isDirectory()) throw new Error(`--write-env: directory ${target} does not exist`);
  }
  await access(target, constants.W_OK).catch(() => {
    throw new Error(`--write-env: ${target} is not writable`);
  });
}

/**
 * Sets NAME=value in a dotenv file: every existing NAME line (with or without `export`) is
 * rewritten in place, otherwise one line is appended. Every other line and line ending is kept.
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
  const eol = /\r?\n/.exec(content)?.[0] ?? "\n";
  const line = new RegExp(`^(\\s*)(export\\s+)?${name}\\s*=.*$`);
  const encoded = /^[\w.+/=:-]*$/.test(value) ? value : JSON.stringify(value);
  let found = false;
  // Odd indexes are the separators, kept as they were.
  const parts = content.split(/(\r?\n)/).map((text, i) => {
    const match = i % 2 === 0 ? line.exec(text) : null;
    if (!match) return text;
    found = true;
    return `${match[1]}${match[2] ?? ""}${name}=${encoded}`;
  });
  let next = parts.join("");
  if (!found) {
    if (next.length > 0 && !next.endsWith("\n")) next += eol;
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
  if (!token) throw new Error(`--write-env: the response carried no token, so ${path} was not changed`);
  await writeEnvVar(path, BLOB_TOKEN_ENV, token);
  console.error(`Wrote ${BLOB_TOKEN_ENV} to ${path}`);
  return rest;
}
