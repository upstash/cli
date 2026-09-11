import { closeSync, openSync, statSync, unlinkSync, writeSync } from "node:fs";

const RETRY_MS = 100;
const WAIT_MS = 20_000;
const STALE_MS = 30_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function tryAcquire(lockPath: string): boolean {
  try {
    const fd = openSync(lockPath, "wx", 0o600);
    writeSync(fd, String(process.pid));
    closeSync(fd);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
    return false;
  }
}

function removeIfStale(lockPath: string): void {
  try {
    if (Date.now() - statSync(lockPath).mtimeMs > STALE_MS) unlinkSync(lockPath);
  } catch {
    // Already gone: another process released it.
  }
}

export async function withLock<T>(lockPath: string, fn: () => Promise<T>): Promise<T> {
  const deadline = Date.now() + WAIT_MS;
  while (!tryAcquire(lockPath)) {
    removeIfStale(lockPath);
    if (Date.now() > deadline) {
      throw new Error(`Another upstash process has held ${lockPath} for over ${WAIT_MS / 1000}s. Delete it if no upstash command is running.`);
    }
    await sleep(RETRY_MS);
  }
  try {
    return await fn();
  } finally {
    try {
      unlinkSync(lockPath);
    } catch {
      // Removed as stale by a waiter; nothing to release.
    }
  }
}
