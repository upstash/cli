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

export function readConfig(): Auth | null {
  const path = getConfigPath();
  if (!existsSync(path)) return null;
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return null;
  }
  let parsed: StoredConfig;
  try {
    parsed = JSON.parse(raw) as StoredConfig;
  } catch {
    return null;
  }
  if (!parsed.email || !parsed.api_key) return null;
  return { email: parsed.email, apiKey: parsed.api_key };
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
