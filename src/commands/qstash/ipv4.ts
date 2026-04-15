import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";

export function registerQStashIpv4(qstash: Command): void {
  qstash
    .command("ipv4")
    .description("List IPv4 CIDR blocks used by QStash (for firewall allowlisting)")
    .action(async (flags: Record<string, never>, command: Command) => {
      const auth = resolveAuth(command);
      const addresses = await request<string[]>(auth, "GET", "/v2/qstash/ipv4");
      printJSON(addresses);
    });
}
