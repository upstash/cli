import type { Auth } from "./auth.js";

const BASE_URL = "https://api.upstash.com";

export class HttpError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function request<T>(
  auth: Auth,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const credentials = Buffer.from(`${auth.email}:${auth.apiKey}`).toString("base64");
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();

  if (!response.ok) {
    let message = text || `HTTP ${response.status}`;
    try {
      const parsed = JSON.parse(text) as { error?: unknown; message?: unknown };
      const msg = parsed.error ?? parsed.message;
      if (typeof msg === "string" && msg.length > 0) message = msg;
    } catch {
      // fall through with the raw text
    }
    throw new HttpError(message, response.status);
  }

  if (text === "" || text === '"OK"') return "OK" as T;
  return JSON.parse(text) as T;
}
