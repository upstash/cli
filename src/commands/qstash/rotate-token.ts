import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, printKeyValue, handleError } from "../../output.js";
import type { QStashUser } from "../../types.js";

interface Flags { email?: string; apiKey?: string; json?: boolean }

export function registerQStashRotateToken(qstash: Command): void {
  qstash
    .command("rotate-token <qstash-id>")
    .description("Reset the authentication token for a QStash instance")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .option("--json", "Output as JSON")
    .action(async (qstashId: string, flags: Flags) => {
      const auth = resolveAuth(flags);
      try {
        const q = await request<QStashUser>(
          auth,
          "POST",
          `/v2/qstash/rotate-token/${qstashId}`,
        );
        if (flags.json) { printJSON(q); return; }
        console.log("Token rotated successfully.");
        console.log();
        printKeyValue(q as unknown as Record<string, unknown>);
      } catch (err) {
        handleError(err, flags.json ?? false);
      }
    });
}
