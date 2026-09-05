export type Sleep = (ms: number) => Promise<void>;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Buckets younger than this may still be provisioning on the Blob worker. */
export const PROVISIONING_WINDOW_SECONDS = 5 * 60;
export const PROVISIONING_RETRY_DELAY_MS = 3000;
export const PROVISIONING_MAX_RETRIES = 10;

export function isFreshlyCreated(creationTime: number | undefined, nowSeconds = Date.now() / 1000): boolean {
  if (typeof creationTime !== "number" || !Number.isFinite(creationTime)) return true;
  return nowSeconds - creationTime < PROVISIONING_WINDOW_SECONDS;
}
