import type { Auth } from "./auth.js";
import { telemetryHeaders } from "./telemetry.js";
import { getAccessToken } from "./oauth/refresh.js";

const BASE_URL = (process.env.UPSTASH_API_URL ?? "https://api.upstash.com").replace(/\/$/, "");

export class HttpError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface TokenInfo {
  email: string;
  team_id?: string;
  team_role?: string;
  read_only?: boolean;
  blocked?: boolean;
}

// The backend keeps team lifecycle and membership closed to OAuth tokens on purpose.
const TEAM_MANAGEMENT = [
  { method: "POST", path: /^\/v2\/team$/ },
  { method: "DELETE", path: /^\/v2\/team\/[^/]+$/ },
  { method: "POST", path: /^\/v2\/teams\/member$/ },
  { method: "DELETE", path: /^\/v2\/teams\/member$/ },
];

export const TEAM_MANAGEMENT_NEEDS_API_KEY =
  "Team management needs an API key login: run `upstash login` with an API key from https://console.upstash.com/account/api, or pass --email and --api-key.";

export const READ_ONLY_LOGIN =
  "This login is read-only, so write commands are refused. Run `upstash login --oauth` again and turn read-only off on the consent page.";

function parseErrorMessage(text: string, status: number): string {
  let message = text || `HTTP ${status}`;
  try {
    const parsed = JSON.parse(text) as { error?: unknown; message?: unknown };
    const msg = parsed.error ?? parsed.message;
    if (typeof msg === "string" && msg.length > 0) message = msg;
  } catch {
    // fall through with the raw text
  }
  return message;
}

async function authorizationHeader(auth: Auth, force = false): Promise<string> {
  if (auth.kind === "api-key") {
    return `Basic ${Buffer.from(`${auth.email}:${auth.apiKey}`).toString("base64")}`;
  }
  return `Bearer ${await getAccessToken({ force })}`;
}

export async function fetchTokenInfo(accessToken: string): Promise<TokenInfo> {
  const response = await fetch(`${BASE_URL}/v2/account/oauth/token-info`, {
    headers: { Authorization: `Bearer ${accessToken}`, ...telemetryHeaders() },
  });
  const text = await response.text();
  if (!response.ok) throw new HttpError(parseErrorMessage(text, response.status), response.status);
  return JSON.parse(text) as TokenInfo;
}

async function explainForbidden(auth: Auth, method: string, path: string, fallback: string): Promise<string> {
  if (auth.kind !== "oauth") return fallback;
  if (TEAM_MANAGEMENT.some((r) => r.method === method && r.path.test(path))) return TEAM_MANAGEMENT_NEEDS_API_KEY;
  if (method === "GET" || method === "HEAD") return fallback;
  try {
    const info = await fetchTokenInfo(await getAccessToken());
    if (info.read_only) return READ_ONLY_LOGIN;
  } catch {
    // The original 403 is still the best explanation.
  }
  return fallback;
}

export async function request<T>(
  auth: Auth,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const send = async (authorization: string) =>
    fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
        ...telemetryHeaders(),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  let response = await send(await authorizationHeader(auth));
  if (response.status === 401 && auth.kind === "oauth") {
    response = await send(await authorizationHeader(auth, true));
  }

  const text = await response.text();

  if (!response.ok) {
    let message = parseErrorMessage(text, response.status);
    if (response.status === 403) message = await explainForbidden(auth, method, path, message);
    throw new HttpError(message, response.status);
  }

  if (text === "" || text === '"OK"') return "OK" as T;
  return JSON.parse(text) as T;
}
