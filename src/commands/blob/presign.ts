import { Command, InvalidArgumentError } from "commander";
import { printJSON } from "../../output.js";
import { BucketResolver } from "./buckets.js";
import { formatLocation, parseBlobLocation } from "./transfer.js";

const MAX_EXPIRES_IN = 7 * 24 * 60 * 60;

function expiresIn(value: string): number {
  const seconds = Number(value);
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > MAX_EXPIRES_IN) {
    throw new InvalidArgumentError(`must be a whole number of seconds from 1 to ${MAX_EXPIRES_IN}`);
  }
  return seconds;
}

export function registerBlobPresign(blob: Command): void {
  blob
    .command("presign <uri>")
    .description("Create a temporary download URL for an object, like aws s3 presign")
    .option("--expires-in <seconds>", "How long the URL should work", expiresIn, 3600)
    .option("--token <token>", "Blob bucket token, used for the bucket it was issued for (default: UPSTASH_BLOB_TOKEN)")
    .addHelpText("after", `
A URL never outlives the temporary credential that signs it, so it can expire
sooner than requested; expires_at is when it actually stops working.
`)
    .action(async (uri: string, options: { expiresIn: number; token?: string }, cmd: Command) => {
      const location = parseBlobLocation(uri);
      if (!location.key || location.key.endsWith("/")) throw new Error(`${formatLocation(location)} names no object`);
      const bucket = await new BucketResolver(cmd, options.token).open(location.bucket);
      const signed = await bucket.signedReadUrl(location.key, { expiresIn: options.expiresIn });
      const requested = Date.now() + options.expiresIn * 1000;
      if (signed.expiresAt.getTime() < requested - 60_000) {
        console.error(`note: the URL expires at ${signed.expiresAt.toISOString()}, sooner than requested, because its signing credential expires then`);
      }
      printJSON({ url: signed.url, expires_at: signed.expiresAt.toISOString() });
    });
}
