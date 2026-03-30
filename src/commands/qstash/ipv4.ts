import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, handleError } from "../../output.js";

interface Flags { email?: string; apiKey?: string; json?: boolean }

export function registerQStashIpv4(qstash: Command): void {
  qstash
    .command("ipv4")
    .description("List IPv4 CIDR blocks used by QStash (for firewall allowlisting)")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .option("--json", "Output as JSON")
    .action(async (flags: Flags) => {
      const auth = resolveAuth(flags);
      try {
        const addresses = await request<string[]>(auth, "GET", "/v2/qstash/ipv4");
        if (flags.json) { printJSON(addresses); return; }
        for (const addr of addresses) {
          console.log(addr);
        }
      } catch (err) {
        handleError(err, flags.json ?? false);
      }
    });
}
