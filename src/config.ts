import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { Auth } from "./auth.js";

interface StoredConfig {
  email?: string;
  api_key?: string;
  telemetry_disabled?: boolean;
}

type RawConfig = StoredConfig & { apiKey?: string };

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

function readRawConfig(path: string): RawConfig | null {
  if (!existsSync(path)) return null;
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return null;
  }
  try {
    return JSON.parse(raw) as RawConfig;
  } catch {
    return null;
  }
}

function readConfigFile(path: string): Auth | null {
  const parsed = readRawConfig(path);
  if (!parsed) return null;
  // Accept the new snake_case `api_key` or the legacy camelCase `apiKey`.
  const apiKey = parsed.api_key ?? parsed.apiKey;
  if (!parsed.email || !apiKey) return null;
  return { email: parsed.email, apiKey };
}

export function readConfig(): Auth | null {
  return readConfigFile(getConfigPath()) ?? readConfigFile(getLegacyConfigPath());
}

function writeStoredConfig(body: StoredConfig): string {
  const path = getConfigPath();
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, JSON.stringify(body, null, 2) + "\n", { mode: 0o600 });
  return path;
}

export function writeConfig(auth: Auth): string {
  const existing = readRawConfig(getConfigPath());
  return writeStoredConfig({
    email: auth.email,
    api_key: auth.apiKey,
    ...(existing?.telemetry_disabled === undefined
      ? {}
      : { telemetry_disabled: existing.telemetry_disabled }),
  });
}

export function readTelemetryDisabled(): boolean {
  return readRawConfig(getConfigPath())?.telemetry_disabled === true;
}

export function writeTelemetryDisabled(disabled: boolean): string {
  const existing = readRawConfig(getConfigPath());
  return writeStoredConfig({
    ...(existing?.email === undefined ? {} : { email: existing.email }),
    ...(existing?.api_key ?? existing?.apiKey
      ? { api_key: existing.api_key ?? existing.apiKey }
      : {}),
    telemetry_disabled: disabled,
  });
}

/**
 * Drops the credentials, keeping any telemetry preference: logging out must not
 * silently turn telemetry back on. Returns whether credentials were there.
 */
export function deleteConfig(): boolean {
  const path = getConfigPath();
  const existing = readRawConfig(path);
  if (!existing) return false;
  const hadCredentials = Boolean(existing.email && (existing.api_key ?? existing.apiKey));
  if (existing.telemetry_disabled === undefined) {
    rmSync(path);
  } else {
    writeStoredConfig({ telemetry_disabled: existing.telemetry_disabled });
  }
  return hadCredentials;
}
