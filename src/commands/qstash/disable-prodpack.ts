import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";

export function registerQStashDisableProdpack(qstash: Command): void {
  qstash
    .command("disable-prodpack")
    .description("Disable the production pack for a QStash instance")
    .requiredOption("--qstash-id <id>", "QStash instance ID")
    .action(async (flags: { qstashId: string }, command: Command) => {
      const auth = resolveAuth(command);
      const result = await request(auth, "POST", `/v2/qstash/disable-prodpack/${flags.qstashId}`);
      printJSON(result);
    });
}
