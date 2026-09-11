import type { Command } from "commander";
import { buildBoxProgram, setDefaultToken } from "@upstash/box-cli";
import { envApiKeyAuth } from "../auth.js";
import { readOAuth } from "../config.js";
import { getAccessToken } from "../oauth/refresh.js";
import { plainError } from "../output.js";

export const BOX_NEEDS_OAUTH_OR_BOX_KEY =
  "Upstash Box commands need a browser login (`upstash login --oauth`) or a Box API key (--token or UPSTASH_BOX_API_KEY). Developer API keys are not accepted by Upstash Box.";

// Commands that never contact the API and so need no credential.
const NO_CREDENTIAL = new Set(["completion", "use"]);

export function registerBox(program: Command): void {
  const box = buildBoxProgram()
    .name("box")
    .description("Upstash Box sandboxes (the same commands as the `box` CLI)");
  // The root parses positional options for the box tree; pass-through stays with `exec` itself.
  box.passThroughOptions(false);
  box.hook("preAction", async (_root, actionCommand) => {
    if (NO_CREDENTIAL.has(actionCommand.name())) return;
    const flags = actionCommand.optsWithGlobals() as { token?: string };
    if (flags.token || process.env.UPSTASH_BOX_API_KEY) return;
    // A Developer API key is useless here, so a saved browser login wins even when one is set.
    if (readOAuth()) {
      setDefaultToken(await getAccessToken());
      return;
    }
    const env = envApiKeyAuth();
    const shadow = env.email || env.apiKey ? " UPSTASH_EMAIL / UPSTASH_API_KEY are set, but they cannot be used here." : "";
    throw plainError(BOX_NEEDS_OAUTH_OR_BOX_KEY + shadow);
  });
  program.addCommand(box);
}
