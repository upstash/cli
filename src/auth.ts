export interface Auth {
  email: string;
  apiKey: string;
}

export function resolveAuth(flags: { email?: string; apiKey?: string }): Auth {
  const email = flags.email ?? process.env.UPSTASH_EMAIL;
  const apiKey = flags.apiKey ?? process.env.UPSTASH_API_KEY;

  if (!email || !apiKey) {
    throw new Error(
      "Authentication required. Provide credentials via --email and --api-key flags, set UPSTASH_EMAIL and UPSTASH_API_KEY environment variables, or add them to a .env file in the current directory."
    );
  }

  return { email, apiKey };
}
