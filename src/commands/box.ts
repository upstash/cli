import type { Command } from "commander";
import { buildBoxProgram, setDefaultToken } from "@upstash/box-cli";
import { resolveAuthWithSource } from "../auth.js";
import { getAccessToken } from "../oauth/refresh.js";
import { plainError } from "../output.js";

export const BOX_NEEDS_OAUTH_OR_BOX_KEY =
  "Upstash Box commands need a browser login (`upstash login --oauth`) or a Box API key (--token or UPSTASH_BOX_API_KEY). Developer API keys are not accepted by Upstash Box.";

export function registerBox(program: Command): void {
  const box = buildBoxProgram()
    .name("box")
    .description("Upstash Box sandboxes (the same commands as the `box` CLI)");
  // The root parses positional options for the box tree; pass-through stays with `exec` itself.
  box.passThroughOptions(false);
  box.hook("preAction", async (_root, actionCommand) => {
    const flags = actionCommand.optsWithGlobals() as { token?: string };
    if (flags.token || process.env.UPSTASH_BOX_API_KEY) return;
    let auth;
    try {
      auth = resolveAuthWithSource(actionCommand).auth;
    } catch {
      throw plainError(BOX_NEEDS_OAUTH_OR_BOX_KEY);
    }
    if (auth.kind !== "oauth") throw plainError(BOX_NEEDS_OAUTH_OR_BOX_KEY);
    setDefaultToken(await getAccessToken());
  });
  program.addCommand(box);
}
