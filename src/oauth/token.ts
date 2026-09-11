import type { OAuthTokens } from "../config.js";

export class OAuthError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, description: string | undefined, status: number) {
    super(description ? `${code}: ${description}` : code);
    this.code = code;
    this.status = status;
  }
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

async function tokenRequest(issuer: string, path: string, params: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch(`${issuer}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const text = await response.text();
  let parsed: TokenResponse = {};
  try {
    parsed = text ? (JSON.parse(text) as TokenResponse) : {};
  } catch {
    parsed = {};
  }
  if (!response.ok) {
    const code = parsed.error ?? (response.status >= 500 ? "server_error" : `http_${response.status}`);
    throw new OAuthError(code, parsed.error_description ?? (parsed.error ? undefined : text.slice(0, 200)), response.status);
  }
  return parsed;
}

function toTokens(issuer: string, body: TokenResponse, previousRefreshToken?: string): OAuthTokens {
  const refresh = body.refresh_token ?? previousRefreshToken;
  if (!body.access_token || !refresh) {
    throw new OAuthError("invalid_response", "the token response had no access or refresh token", 200);
  }
  const expiresIn = typeof body.expires_in === "number" ? body.expires_in : 3600;
  return {
    issuer,
    access_token: body.access_token,
    refresh_token: refresh,
    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
  };
}

export async function exchangeCode(input: {
  issuer: string;
  clientId: string;
  code: string;
  redirectUri: string;
  verifier: string;
}): Promise<OAuthTokens> {
  const body = await tokenRequest(input.issuer, "/oauth/token", {
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri,
    client_id: input.clientId,
    code_verifier: input.verifier,
  });
  return toTokens(input.issuer, body);
}

export async function refreshTokens(issuer: string, clientId: string, refreshToken: string): Promise<OAuthTokens> {
  const body = await tokenRequest(issuer, "/oauth/token", {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
  });
  return toTokens(issuer, body, refreshToken);
}

export async function revokeRefreshToken(issuer: string, clientId: string, refreshToken: string): Promise<void> {
  await tokenRequest(issuer, "/oauth/token/revoke", {
    token: refreshToken,
    token_type_hint: "refresh_token",
    client_id: clientId,
  });
}
