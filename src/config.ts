import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { Auth } from "./auth.js";

interface StoredConfig {
  email?: string;
  api_key?: string;
}

export function getConfigDir(): string {
  const override = process.env.UPSTASH_CONFIG_HOME;
  if (override) return override;
  const xdg = process.env.XDG_CONFIG_HOME;
  const base = xdg && xdg.length > 0 ? xdg : join(homedir(), ".config");
  return join(base, "upstash");
}

export function getConfigPath(): string {
  return join(getConfigDir(), "config.json");
}

// The 0.x CLI stored credentials at ~/.upstash.json with a camelCase `apiKey`.
// We read it as a fallback so users upgrading to 1.x stay logged in. The path
// is overridable for tests, mirroring UPSTASH_CONFIG_HOME.
export function getLegacyConfigPath(): string {
  const override = process.env.UPSTASH_LEGACY_CONFIG_HOME;
  const base = override && override.length > 0 ? override : homedir();
  return join(base, ".upstash.json");
}

function readConfigFile(path: string): Auth | null {
  if (!existsSync(path)) return null;
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return null;
  }
  let parsed: StoredConfig & { apiKey?: string };
  try {
    parsed = JSON.parse(raw) as StoredConfig & { apiKey?: string };
  } catch {
    return null;
  }
  // Accept the new snake_case `api_key` or the legacy camelCase `apiKey`.
  const apiKey = parsed.api_key ?? parsed.apiKey;
  if (!parsed.email || !apiKey) return null;
  return { email: parsed.email, apiKey };
}

export function readConfig(): Auth | null {
  return readConfigFile(getConfigPath()) ?? readConfigFile(getLegacyConfigPath());
}

export function writeConfig(auth: Auth): string {
  const path = getConfigPath();
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const body: StoredConfig = { email: auth.email, api_key: auth.apiKey };
  writeFileSync(path, JSON.stringify(body, null, 2) + "\n", { mode: 0o600 });
  return path;
}

export function deleteConfig(): boolean {
  const path = getConfigPath();
  if (!existsSync(path)) return false;
  rmSync(path);
  return true;
}
