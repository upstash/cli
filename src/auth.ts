export interface Auth {
  email: string;
  apiKey: string;
}

import type { Command } from "commander";
import { readConfig } from "./config.js";

export function resolveAuth(cmdOrFlags: Command | { email?: string; apiKey?: string }): Auth {
  const opts = typeof (cmdOrFlags as Command).optsWithGlobals === "function"
    ? (cmdOrFlags as Command).optsWithGlobals()
    : cmdOrFlags;
  const flagEmail = (opts as { email?: string }).email;
  const flagKey = (opts as { apiKey?: string }).apiKey;
  const envEmail = process.env.UPSTASH_EMAIL;
  const envKey = process.env.UPSTASH_API_KEY;

  // If any flag/env auth signal is present, resolve from that tier only —
  // don't mix a partial session with the saved config, since that silently
  // combines credentials from different accounts.
  if (flagEmail || flagKey || envEmail || envKey) {
    const email = flagEmail ?? envEmail;
    const apiKey = flagKey ?? envKey;
    if (!email || !apiKey) {
      throw new Error(
        "Authentication is incomplete: provide both --email and --api-key, or set both UPSTASH_EMAIL and UPSTASH_API_KEY. Or unset them and run `upstash login` to use saved credentials."
      );
    }
    return { email, apiKey };
  }

  const stored = readConfig();
  if (stored) return stored;

  throw new Error(
    "Authentication required. Run `upstash login` to save credentials, or provide --email and --api-key flags, or set UPSTASH_EMAIL and UPSTASH_API_KEY environment variables (also honored from a .env file in the current directory)."
  );
}
