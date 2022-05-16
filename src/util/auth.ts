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
  let email = "";
  let apiKey = "";
  const config = loadConfig(options.config);
  if (config) {
    email = config.email;
    apiKey = config.apiKey;
    // }

    // if (email == "") {
    //   if (options.upstashEmail) {
    //     email = options.upstashEmail;
    //   } else if (!options.ci) {
    //     email = await cliffy.Input.prompt("Enter your email");
    //   }
    //   if (email === "") {
    //     throw new cliffy.ValidationError(
    //       "Provide either `UPSTASH_EMAIL` or --email=",
    //     );
    //   }
    // }
    // if (apiKey === "") {
    //   if (options.upstashApiKey) {
    //     apiKey = options.upstashApiKey;
    //   } else if (!options.ci) {
    //     apiKey = await cliffy.Secret.prompt("Enter your api apiKey");
    //   }
    //   if (apiKey === "") {
    //     throw new cliffy.ValidationError(
    //       "Provide either `UPSTASH_TOKEN` or --apiKey=",
    //     );
    //   }
    // }
  }

  if (!email || email === "") {
    throw new cliffy.ValidationError("email");
  }
  if (!apiKey || apiKey === "") {
    throw new cliffy.ValidationError("apiKey");
  }
  return await Promise.resolve(
    `Basic ${base64.encode([email, apiKey].join(":"))}`,
  );
}
