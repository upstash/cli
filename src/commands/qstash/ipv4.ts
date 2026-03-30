import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, handleError } from "../../output.js";

export function registerQStashIpv4(qstash: Command): void {
  qstash
    .command("ipv4")
    .description("List IPv4 CIDR blocks used by QStash (for firewall allowlisting)")
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .action(async (flags: { email?: string; apiKey?: string }) => {
      const auth = resolveAuth(flags);
      try {
        const addresses = await request<string[]>(auth, "GET", "/v2/qstash/ipv4");
        printJSON(addresses);
      } catch (err) {
        handleError(err);
      }
    });
}
