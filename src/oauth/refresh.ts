import { clearOAuth, clearOAuthClient, getConfigPath, readOAuth, readOAuthClient, writeOAuth, type OAuthTokens } from "../config.js";
import { plainError } from "../output.js";
import { withLock } from "./lock.js";
import { OAuthError, refreshTokens } from "./token.js";

const EXPIRY_MARGIN_S = 5 * 60;
const TRANSIENT_RETRIES = 2;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const LOGIN_EXPIRED = "Your Upstash login has expired. Run `upstash login --oauth` to sign in again.";

function isFresh(tokens: OAuthTokens): boolean {
  return tokens.expires_at - Math.floor(Date.now() / 1000) > EXPIRY_MARGIN_S;
}

function isTransient(err: unknown): boolean {
  if (err instanceof OAuthError) return err.status >= 500;
  return !(err instanceof OAuthError);
}

async function refreshWithRetry(tokens: OAuthTokens, clientId: string): Promise<OAuthTokens> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await refreshTokens(tokens.issuer, clientId, tokens.refresh_token);
    } catch (err) {
      if (err instanceof OAuthError && err.code === "invalid_grant") {
        clearOAuth();
        throw plainError(LOGIN_EXPIRED);
      }
      if (err instanceof OAuthError && err.code === "invalid_client") {
        clearOAuth();
        clearOAuthClient();
        throw plainError(LOGIN_EXPIRED);
      }
      if (!isTransient(err) || attempt >= TRANSIENT_RETRIES) throw err;
      await sleep(500 * (attempt + 1));
    }
  }
}

/**
 * Returns a usable access token, refreshing under a cross-process lock. The
 * issuer rotates refresh tokens and revokes the whole login when one is reused,
 * so two commands refreshing at once must never both reach the token endpoint.
 */
export async function getAccessToken(options: { force?: boolean } = {}): Promise<string> {
  const seen = readOAuth();
  if (!seen) throw plainError(LOGIN_EXPIRED);
  if (!options.force && isFresh(seen)) return seen.access_token;

  return withLock(`${getConfigPath()}.lock`, async () => {
    const current = readOAuth();
    if (!current) throw plainError(LOGIN_EXPIRED);
    const refreshedByOther = current.access_token !== seen.access_token;
    if (refreshedByOther && (isFresh(current) || options.force)) return current.access_token;
    const client = readOAuthClient();
    if (!client) throw plainError(LOGIN_EXPIRED);
    const next = await refreshWithRetry(current, client.client_id);
    writeOAuth(next);
    return next.access_token;
  });
}
