import { base64, cliffy } from "../deps.ts";
import { loadConfig } from "../config.ts";
/**
 * Parse cli config and return a basic auth header string
 */
export async function parseAuth(options: {
  upstashEmail?: string;
  upstashApiKey?: string;
  config: string;
  ci?: boolean;
  [key: string]: unknown;
}): Promise<string> {
  let email = options.upstashEmail;
  let apiKey = options.upstashApiKey;
  const config = loadConfig(options.config);
  if (config?.email) {
    email = config.email;
  }
  if (config?.apiKey) {
    apiKey = config.apiKey;
  }

  if (!email) {
    throw new cliffy.ValidationError("email");
  }
  if (!apiKey) {
    throw new cliffy.ValidationError("apiKey");
  }
  return await Promise.resolve(
    `Basic ${base64.encode([email, apiKey].join(":"))}`,
  );
}
