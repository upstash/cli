export type Auth =
  | { kind: "api-key"; email: string; apiKey: string }
  | { kind: "oauth" };

export type AuthSource = "flag" | "env" | "config";

import type { Command } from "commander";
import { readConfig } from "./config.js";

type AuthFlags = { email?: string; apiKey?: string };

export function envApiKeyAuth(): { email?: string; apiKey?: string } {
  return { email: process.env.UPSTASH_EMAIL, apiKey: process.env.UPSTASH_API_KEY };
}

export function resolveAuthWithSource(cmdOrFlags: Command | AuthFlags): { auth: Auth; source: AuthSource } {
  const opts = typeof (cmdOrFlags as Command).optsWithGlobals === "function"
    ? (cmdOrFlags as Command).optsWithGlobals()
    : cmdOrFlags;
  const flagEmail = (opts as AuthFlags).email;
  const flagKey = (opts as AuthFlags).apiKey;
  const { email: envEmail, apiKey: envKey } = envApiKeyAuth();

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
    return { auth: { kind: "api-key", email, apiKey }, source: flagEmail || flagKey ? "flag" : "env" };
  }

  const stored = readConfig();
  if (stored) return { auth: stored, source: "config" };

  throw new Error(
    "Authentication required. Run `upstash login --oauth` to sign in through the browser or `upstash login` to save an API key, or provide --email and --api-key flags, or set UPSTASH_EMAIL and UPSTASH_API_KEY environment variables (also honored from a .env file in the current directory)."
  );
}

export function resolveAuth(cmdOrFlags: Command | AuthFlags): Auth {
  return resolveAuthWithSource(cmdOrFlags).auth;
}
