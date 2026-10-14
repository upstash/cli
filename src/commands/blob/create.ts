import { Command, InvalidArgumentError } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";
import { BLOB_VISIBILITIES } from "../../types.js";
import type { BlobBucket, BlobVisibility } from "../../types.js";
import { checkEnvFileTarget, ENV_FILE_HELP, saveBucketToken } from "./env-file.js";

export function parseVisibility(value: string): BlobVisibility {
  if ((BLOB_VISIBILITIES as readonly string[]).includes(value)) {
    return value as BlobVisibility;
  }
  throw new InvalidArgumentError(
    `--visibility must be one of: ${BLOB_VISIBILITIES.join(", ")}; got "${value}"`,
  );
}

export const CORS_HELP =
  "Allowed CORS origins, space-separated, each http(s)://host[:port] " +
  "(e.g. http://localhost:3000 https://app.example.com). " +
  "Omit --cors to allow all origins (*). Browser uploads are refused from any origin not listed";

const ORIGIN_EXAMPLE = "expected http(s)://host[:port], e.g. https://app.example.com or http://localhost:3000";
const WILDCARD = "wildcard.invalid";

/**
 * One origin as the browser sends it in the Origin header: `*`, or http(s)://host[:port] with no
 * path, query or trailing slash. A wildcard may stand in for part of the host (https://*.example.com).
 * Anything else would be stored and never match, so it is refused here rather than by the API.
 */
export function corsOriginProblem(value: string): string | undefined {
  if (value === "*") return undefined;
  const shown = JSON.stringify(value);
  if (value.trim() === "") return `${shown} is not a valid origin, ${ORIGIN_EXAMPLE}`;
  if (/[\s,]/.test(value.trim())) {
    return `${shown} is not a valid origin: pass each origin as its own argument, separated by spaces (--cors https://a.example.com https://b.example.com)`;
  }
  if (!value.includes("://")) {
    const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/i.test(value);
    const guess = suggestion(`${local ? "http" : "https"}://${value}`, true);
    return `${shown} is not a valid origin, ${ORIGIN_EXAMPLE}${guess ? ` (did you mean ${guess}?)` : ""}`;
  }
  if (/^https?:\/\//i.test(value)) {
    const guess = suggestion(value);
    if (guess === value) return undefined;
    return `${shown} is not a valid origin, ${ORIGIN_EXAMPLE}${guess ? ` (did you mean ${guess}?)` : ""}`;
  }
  // The console takes http and https only, and so does this.
  return `${shown} is not a valid origin, ${ORIGIN_EXAMPLE}`;
}

/**
 * The http(s) origin a value most likely meant, or undefined when it does not parse as one. A
 * scheme we added ourselves only counts on a host that looks like one: a bare word is a typo.
 */
function suggestion(value: string, guessedScheme = false): string | undefined {
  try {
    const url = new URL(value.replaceAll("*", WILDCARD));
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    if (!url.hostname || url.username || url.password) return undefined;
    if (guessedScheme && !/[.[]/.test(url.hostname) && url.hostname !== "localhost") return undefined;
    return url.origin.replaceAll(WILDCARD, "*");
  } catch {
    return undefined;
  }
}

/** Commander parser for the variadic --cors: validates each origin and collects them. */
export function parseCorsOrigin(value: string, previous: string[] | undefined): string[] {
  const problem = corsOriginProblem(value);
  if (problem) throw new InvalidArgumentError(problem);
  return [...(previous ?? []), value];
}

export function registerBlobCreate(blob: Command): void {
  blob
    .command("create")
    .description("Create a Blob bucket. Add --env-file .env.local to save its token for @upstash/blob")
    .requiredOption("--name <name>", "Bucket name")
    .option(
      "--visibility <visibility>",
      `Bucket visibility. Available: ${BLOB_VISIBILITIES.join(", ")}`,
      parseVisibility,
      "private",
    )
    .option("--cors <origins...>", CORS_HELP, parseCorsOrigin)
    .option("--env-file <path>", ENV_FILE_HELP)
    .addHelpText(
      "after",
      "\nExample:\n  upstash blob create --name my-bucket --env-file .env.local",
    )
    .action(
      async (
        flags: { name: string; visibility: BlobVisibility; cors?: string[]; envFile?: string },
        command: Command,
      ) => {
        const auth = resolveAuth(command);
        if (flags.envFile !== undefined) await checkEnvFileTarget(flags.envFile);
        const bucket = await request<BlobBucket>(auth, "POST", "/v2/blob/bucket", {
          name: flags.name,
          visibility: flags.visibility,
          cors: flags.cors,
        });
        if (flags.envFile === undefined) {
          printJSON(bucket);
          return;
        }
        try {
          printJSON(await saveBucketToken(bucket, flags.envFile));
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          throw new Error(
            `bucket ${bucket.name} was created, but its token could not be written (${reason}); ` +
              `run: upstash blob get ${bucket.name} --env-file ${shellQuote(flags.envFile)}`,
          );
        }
      },
    );
}

function shellQuote(value: string): string {
  return /^[\w./-]+$/.test(value) ? value : `'${value.replaceAll("'", "'\\''")}'`;
}
