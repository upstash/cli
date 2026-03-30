import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, handleError } from "../../output.js";

interface Flags { email?: string; apiKey?: string; json?: boolean }

export function registerQStashEnableProdpack(qstash: Command): void {
  qstash
    .command("enable-prodpack <qstash-id>")
    .description("Enable the production pack for a QStash instance")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .option("--json", "Output as JSON")
    .action(async (qstashId: string, flags: Flags) => {
      const auth = resolveAuth(flags);
      try {
        await request(auth, "POST", `/v2/qstash/enable-prodpack/${qstashId}`);
        if (flags.json) { printJSON({ success: true, qstash_id: qstashId }); return; }
        console.log("Production pack enabled.");
      } catch (err) {
        handleError(err, flags.json ?? false);
      }
    });
}
