import { readFileSync, writeFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const CONFIG_PATH = join(homedir(), ".upstash.json");

export interface Auth {
  email: string;
  apiKey: string;
}

interface Config {
  email?: string;
  api_key?: string;
}

function readConfig(): Config {
  if (!existsSync(CONFIG_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf-8")) as Config;
  } catch {
    return {};
  }
}

export function saveAuth(email: string, apiKey: string): void {
  const config: Config = { email, api_key: apiKey };
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function clearAuth(): void {
  writeFileSync(CONFIG_PATH, JSON.stringify({}), { mode: 0o600 });
}

export function resolveAuth(flags: { email?: string; apiKey?: string }): Auth {
  const config = readConfig();
  const email = flags.email ?? process.env.UPSTASH_EMAIL ?? config.email;
  const apiKey = flags.apiKey ?? process.env.UPSTASH_API_KEY ?? config.api_key;

  if (!email || !apiKey) {
    console.error(
      "Error: Authentication required.\n" +
        "  Set UPSTASH_EMAIL and UPSTASH_API_KEY environment variables, or\n" +
        "  run: upstash auth login --email <email> --api-key <key>",
    );
    process.exit(1);
  }

  return { email, apiKey };
}
