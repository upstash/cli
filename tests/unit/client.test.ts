import { afterEach, describe, expect, it, vi } from "vitest";
import { request } from "../../src/client.js";

const auth = { email: "user@example.com", apiKey: "key" };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("request", () => {
  it("identifies the cli through the telemetry headers", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));

    await request(auth, "GET", "/v2/redis/databases");

    const headers = fetchMock.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers["Upstash-Telemetry-Sdk"]).toMatch(/^@upstash\/cli@/);
    expect(headers["Upstash-Telemetry-Runtime"]).toBeTruthy();
    expect(headers["Upstash-Telemetry-Platform"]).toBeTruthy();
    expect(headers.Authorization).toBe(
      `Basic ${Buffer.from("user@example.com:key").toString("base64")}`,
    );
  });
});
