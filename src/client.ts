import type { Auth } from "./auth.js";

const BASE_URL = "https://api.upstash.com";

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
    throw new Error(text || `HTTP ${response.status}`);
  }

  if (text === "" || text === '"OK"') return "OK" as T;
  return JSON.parse(text) as T;
}
