import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";

export function registerQStashEnableProdpack(qstash: Command): void {
  qstash
    .command("enable-prodpack")
    .description("Enable the production pack for a QStash instance")
    .requiredOption("--qstash-id <id>", "QStash instance ID")
    .action(async (flags: { qstashId: string }, command: Command) => {
      const auth = resolveAuth(command);
      const result = await request(auth, "POST", `/v2/qstash/enable-prodpack/${flags.qstashId}`);
      printJSON(result);
    });
}
