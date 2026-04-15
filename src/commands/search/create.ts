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
    .action(async (flags: { name: string; region: string; type: string }, command: Command) => {
      const auth = resolveAuth(command);
      const idx = await request<SearchIndex>(auth, "POST", "/v2/search", { name: flags.name, region: flags.region, type: flags.type });
      printJSON(idx);
    });
}
