import { readFileSync, writeFileSync, mkdirSync, rmSync, renameSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";
import type { Auth } from "./auth.js";

export interface OAuthTokens {
  issuer: string;
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export interface OAuthClient {
  issuer: string;
  client_id: string;
  redirect_uri: string;
  registered_at: number;
}

interface StoredConfig {
  email?: string;
  api_key?: string;
  oauth?: OAuthTokens;
  oauth_client?: OAuthClient;
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

function isOAuthTokens(value: unknown): value is OAuthTokens {
  const v = value as Partial<OAuthTokens> | undefined;
  return (
    typeof v?.issuer === "string" &&
    typeof v.access_token === "string" &&
    typeof v.refresh_token === "string" &&
    typeof v.expires_at === "number"
  );
}

function readApiKeyAuth(path: string): Auth | null {
  const parsed = readRawConfig(path);
  if (!parsed) return null;
  // Accept the new snake_case `api_key` or the legacy camelCase `apiKey`.
  const apiKey = parsed.api_key ?? parsed.apiKey;
  if (!parsed.email || !apiKey) return null;
  return { kind: "api-key", email: parsed.email, apiKey };
}

export function readConfig(): Auth | null {
  const current = readRawConfig(getConfigPath());
  if (current && isOAuthTokens(current.oauth)) return { kind: "oauth" };
  return readApiKeyAuth(getConfigPath()) ?? readApiKeyAuth(getLegacyConfigPath());
}

export function readOAuth(): OAuthTokens | null {
  const parsed = readRawConfig(getConfigPath());
  return parsed && isOAuthTokens(parsed.oauth) ? parsed.oauth : null;
}

export function readOAuthClient(): OAuthClient | null {
  const client = readRawConfig(getConfigPath())?.oauth_client;
  return client && typeof client.client_id === "string" && typeof client.issuer === "string" ? client : null;
}

// A crash between truncate and write must not leave an empty file that reads as logged out.
function writeStoredConfig(body: StoredConfig): string {
  const path = getConfigPath();
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const tmp = `${path}.${process.pid}.${randomBytes(4).toString("hex")}.tmp`;
  writeFileSync(tmp, JSON.stringify(body, null, 2) + "\n", { mode: 0o600 });
  renameSync(tmp, path);
  return path;
}

function updateConfig(mutate: (current: StoredConfig) => StoredConfig): string {
  const existing = readRawConfig(getConfigPath()) ?? {};
  const { apiKey, ...current } = existing;
  if (apiKey && current.api_key === undefined) current.api_key = apiKey;
  return writeStoredConfig(mutate(current));
}

export function writeConfig(auth: { email: string; apiKey: string }): string {
  return updateConfig(({ email: _e, api_key: _k, oauth: _o, ...rest }) => ({
    email: auth.email,
    api_key: auth.apiKey,
    ...rest,
  }));
}

export function writeOAuth(tokens: OAuthTokens): string {
  return updateConfig(({ email: _e, api_key: _k, ...rest }) => ({ ...rest, oauth: tokens }));
}

export function clearOAuth(): string {
  return updateConfig(({ oauth: _o, ...rest }) => rest);
}

export function writeOAuthClient(client: OAuthClient): string {
  return updateConfig((current) => ({ ...current, oauth_client: client }));
}

export function clearOAuthClient(): string {
  return updateConfig(({ oauth_client: _c, ...rest }) => rest);
}

export function readTelemetryDisabled(): boolean {
  return readRawConfig(getConfigPath())?.telemetry_disabled === true;
}

export function writeTelemetryDisabled(disabled: boolean): string {
  return updateConfig((current) => ({ ...current, telemetry_disabled: disabled }));
}

/**
 * Drops the credentials, keeping the telemetry preference and the registered
 * OAuth client: logging out must not silently turn telemetry back on, and a
 * later login should replace the same grant. Returns whether credentials were there.
 */
export function deleteConfig(): boolean {
  const path = getConfigPath();
  const existing = readRawConfig(path);
  if (!existing) return false;
  const hadCredentials = Boolean(
    (existing.email && (existing.api_key ?? existing.apiKey)) || isOAuthTokens(existing.oauth),
  );
  const { email: _e, api_key: _k, apiKey: _a, oauth: _o, ...rest } = existing;
  if (Object.keys(rest).length === 0) {
    rmSync(path);
  } else {
    writeStoredConfig(rest);
  }
  return hadCredentials;
}
