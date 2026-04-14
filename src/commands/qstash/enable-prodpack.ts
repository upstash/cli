import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";

export function registerQStashEnableProdpack(qstash: Command): void {
  qstash
    .command("enable-prodpack")
    .description("Enable the production pack for a QStash instance")
    .requiredOption("--qstash-id <id>", "QStash instance ID")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .action(async (flags: { qstashId: string; email?: string; apiKey?: string }) => {
      const auth = resolveAuth(flags);
      const result = await request(auth, "POST", `/v2/qstash/enable-prodpack/${flags.qstashId}`);
      printJSON(result);
    });
}
