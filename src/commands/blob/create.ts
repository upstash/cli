import { Command, InvalidArgumentError } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";
import { BLOB_VISIBILITIES } from "../../types.js";
import type { BlobBucket, BlobVisibility } from "../../types.js";

function parseVisibility(value: string): BlobVisibility {
  if ((BLOB_VISIBILITIES as readonly string[]).includes(value)) {
    return value as BlobVisibility;
  }
  throw new InvalidArgumentError(
    `--visibility must be one of: ${BLOB_VISIBILITIES.join(", ")}; got "${value}"`,
  );
}

export function registerBlobCreate(blob: Command): void {
  blob
    .command("create")
    .description("Create a Blob bucket")
    .requiredOption("--name <name>", "Bucket name")
    .option(
      "--visibility <visibility>",
      `Bucket visibility. Available: ${BLOB_VISIBILITIES.join(", ")}`,
      parseVisibility,
      "private",
    )
    .option("--cors <origins...>", "Allowed CORS origins (space-separated)")
    .action(
      async (
        flags: { name: string; visibility: BlobVisibility; cors?: string[] },
        command: Command,
      ) => {
        const auth = resolveAuth(command);
        const bucket = await request<BlobBucket>(auth, "POST", "/v2/blob/bucket", {
          name: flags.name,
          visibility: flags.visibility,
          cors: flags.cors,
        });
        printJSON(bucket);
      },
    );
}
