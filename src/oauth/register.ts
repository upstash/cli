import { hostname } from "node:os";
import { readOAuthClient, writeOAuthClient, type OAuthClient } from "../config.js";
import { REDIRECT_PATH, SCOPE } from "./issuer.js";

export async function registerClient(issuer: string): Promise<OAuthClient> {
  const redirectUri = `http://127.0.0.1${REDIRECT_PATH}`;
  const response = await fetch(`${issuer}/oauth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: `Upstash CLI (${hostname()})`,
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: SCOPE,
    }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Could not register the CLI with ${issuer} (HTTP ${response.status}): ${text.slice(0, 200)}`);
  }
  const body = JSON.parse(text) as { client_id?: string };
  if (!body.client_id) throw new Error(`Registration with ${issuer} returned no client_id.`);
  const client: OAuthClient = {
    issuer,
    client_id: body.client_id,
    redirect_uri: redirectUri,
    registered_at: Math.floor(Date.now() / 1000),
  };
  writeOAuthClient(client);
  return client;
}

// One client per install: re-login then replaces the same grant instead of adding one.
export async function ensureClient(issuer: string): Promise<OAuthClient> {
  const stored = readOAuthClient();
  if (stored && stored.issuer === issuer) return stored;
  return registerClient(issuer);
}
