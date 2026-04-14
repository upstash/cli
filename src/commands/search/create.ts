import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON } from "../../output.js";
import { SEARCH_REGIONS, SEARCH_PLANS } from "../../types.js";
import type { SearchIndex } from "../../types.js";

export function registerSearchCreate(search: Command): void {
  search
    .command("create")
    .description("Create a new search index")
    .requiredOption("--name <name>", "Index name")
    .requiredOption("--region <region>", `Region. Available: ${SEARCH_REGIONS.join(", ")}`)
    .requiredOption("--type <type>", `Plan type. Available: ${SEARCH_PLANS.join(", ")}`)
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .action(async (flags: { email?: string; apiKey?: string; name: string; region: string; type: string }) => {
      const auth = resolveAuth(flags);
      const idx = await request<SearchIndex>(auth, "POST", "/v2/search", { name: flags.name, region: flags.region, type: flags.type });
      printJSON(idx);
    });
}
