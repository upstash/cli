import { Command, Option } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";
import type { BlobBucket } from "../../types.js";
import { bucketIdArgument } from "./buckets.js";
import { ENV_FILE_HELP, saveBucketToken } from "./env-file.js";

export function registerBlobGet(blob: Command): void {
  blob
    .command("get [bucket]")
    .description("Get details of a Blob bucket, by name or id")
    .addOption(new Option("--bucket-id <id>").hideHelp())
    .option("--hide-credentials", "Omit bucket tokens from output")
    .option("--env-file <path>", ENV_FILE_HELP)
    .addHelpText("after", "\nExample:\n  upstash blob get my-bucket --env-file .env.local")
    .action(async (name: string | undefined, flags: { bucketId?: string; hideCredentials?: boolean; envFile?: string }, command: Command) => {
      const id = await bucketIdArgument(command, name, flags);
      const bucket = await request<BlobBucket>(resolveAuth(command), "GET", `/v2/blob/bucket/${id}`);
      if (flags.envFile !== undefined) {
        printJSON(await saveBucketToken(bucket, flags.envFile));
        return;
      }
      if (!flags.hideCredentials) {
        printJSON(bucket);
        return;
      }
      const { token: _token, token_next: _tokenNext, ...safeBucket } = bucket;
      printJSON(safeBucket);
    });
}
