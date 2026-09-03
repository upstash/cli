import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";
import type { BlobBucket } from "../../types.js";

export function registerBlobList(blob: Command): void {
  blob
    .command("list")
    .description("List Blob buckets")
    .action(async (flags: Record<string, never>, command: Command) => {
      const auth = resolveAuth(command);
      const buckets = await request<BlobBucket[]>(auth, "GET", "/v2/blob/bucket");
      printJSON(buckets);
    });
}
