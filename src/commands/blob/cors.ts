import { Argument, Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";
import type { BlobBucket } from "../../types.js";
import { bucketIdArgument } from "./buckets.js";
import { parseCorsOrigin } from "./create.js";

export function registerBlobCors(blob: Command): void {
  blob
    .command("cors")
    .description("Replace the allowed CORS origins of a Blob bucket, by name or id")
    .argument("<bucket>", "Bucket name or id")
    .addArgument(
      new Argument(
        "<origins...>",
        "New origins, space-separated, each http(s)://host[:port]; '*' allows all origins",
      ).argParser(parseCorsOrigin),
    )
    .addHelpText(
      "after",
      "\nExamples:\n" +
        "  upstash blob cors my-bucket https://app.example.com http://localhost:3000\n" +
        "  upstash blob cors my-bucket '*'   # allow all origins again",
    )
    .action(async (name: string, origins: string[], _flags: object, command: Command) => {
      const id = await bucketIdArgument(command, name, {});
      const bucket = await request<BlobBucket>(resolveAuth(command), "POST", `/v2/blob/bucket/${id}/cors`, {
        cors: origins,
      });
      printJSON(bucket);
    });
}
