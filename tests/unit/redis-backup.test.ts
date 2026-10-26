import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRedisProgram, runCommand } from "../helpers/program.js";

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...originalEnv, UPSTASH_EMAIL: "user@example.com", UPSTASH_API_KEY: "api-key" };
});

afterEach(() => {
  vi.restoreAllMocks();
  process.env = { ...originalEnv };
});

describe("redis backup daily schedule", () => {
  // The API registers these routes for PATCH only; POST got "404 page not found".
  it.each([
    ["enable-daily", "enable-dailybackup"],
    ["disable-daily", "disable-dailybackup"],
  ])("%s sends PATCH /v2/redis/%s/:id", async (command, route) => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json("OK"));
    const program = await createRedisProgram();

    await runCommand(program, ["redis", "backup", command, "--db-id", "db_123"]);

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.upstash.com/v2/redis/${route}/db_123`);
    expect(init.method).toBe("PATCH");
  });
});
