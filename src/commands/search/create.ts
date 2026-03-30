import { Command } from "commander";
import { resolveAuth } from "../../auth.js";
import { request } from "../../client.js";
import { printJSON, printKeyValue, handleError } from "../../output.js";
import { SEARCH_REGIONS, SEARCH_PLANS } from "../../types.js";
import type { SearchIndex } from "../../types.js";

interface Flags {
  email?: string;
  apiKey?: string;
  json?: boolean;
  name: string;
  region: string;
  type: string;
}

export function registerSearchCreate(search: Command): void {
  search
    .command("create")
    .description("Create a new search index")
    .requiredOption("--name <name>", "Index name")
    .requiredOption(
      "--region <region>",
      `Region. Available: ${SEARCH_REGIONS.join(", ")}`,
    )
    .requiredOption(
      "--type <type>",
      `Plan type. Available: ${SEARCH_PLANS.join(", ")}`,
    )
    .option("--email <email>", "Upstash email")
    .option("--api-key <key>", "Upstash API key")
    .option("--json", "Output as JSON")
    .action(async (flags: Flags) => {
      const auth = resolveAuth(flags);
      try {
        const idx = await request<SearchIndex>(auth, "POST", "/v2/search", {
          name: flags.name,
          region: flags.region,
          type: flags.type,
        });
        if (flags.json) { printJSON(idx); return; }
        console.log(`Search index '${idx.name}' created.`);
        console.log();
        printKeyValue(idx as unknown as Record<string, unknown>);
      } catch (err) {
        handleError(err, flags.json ?? false);
      }
    });
}
