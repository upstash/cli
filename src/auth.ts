export interface Auth {
  email: string;
  apiKey: string;
}

export function resolveAuth(flags: { email?: string; apiKey?: string }): Auth {
  const email = flags.email ?? process.env.UPSTASH_EMAIL;
  const apiKey = flags.apiKey ?? process.env.UPSTASH_API_KEY;

  if (!email || !apiKey) {
    console.error(
      JSON.stringify({ error: "Authentication required. Provide credentials via --email and --api-key flags or set UPSTASH_EMAIL and UPSTASH_API_KEY environment variables." }),
    );
    process.exit(1);
  }

  return { email, apiKey };
}
