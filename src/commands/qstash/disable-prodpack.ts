import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, handleError } from "../../output.js";

export function registerQStashDisableProdpack(qstash: Command): void {
  qstash
    .command("disable-prodpack")
    .description("Disable the production pack for a QStash instance")
    .requiredOption("--qstash-id <id>", "QStash instance ID")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .action(async (flags: { qstashId: string; email?: string; apiKey?: string }) => {
      const auth = resolveAuth(flags);
      try {
        const result = await request(auth, "POST", `/v2/qstash/disable-prodpack/${flags.qstashId}`);
        printJSON(result);
      } catch (err) {
        handleError(err);
      }
    });
}
