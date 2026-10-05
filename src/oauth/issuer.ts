export const DEFAULT_ISSUER = "https://clerk.upstash.com";
export const SCOPE = "openid email offline_access";
export const REDIRECT_PATH = "/callback";

export function issuerUrl(): string {
  return (process.env.UPSTASH_OAUTH_ISSUER ?? DEFAULT_ISSUER).replace(/\/$/, "");
}
