export interface Auth {
  email: string;
  apiKey: string;
}

import type { Command } from "commander";

export function resolveAuth(cmdOrFlags: Command | { email?: string; apiKey?: string }): Auth {
  const opts = typeof (cmdOrFlags as Command).optsWithGlobals === "function"
    ? (cmdOrFlags as Command).optsWithGlobals()
    : cmdOrFlags;
  const email = (opts as { email?: string }).email ?? process.env.UPSTASH_EMAIL;
  const apiKey = (opts as { apiKey?: string }).apiKey ?? process.env.UPSTASH_API_KEY;

  if (!email || !apiKey) {
    throw new Error(
      "Authentication required. Provide credentials via --email and --api-key flags, set UPSTASH_EMAIL and UPSTASH_API_KEY environment variables, or add them to a .env file in the current directory."
    );
  }

  return { email, apiKey };
}
