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

describe("redis create-branch", () => {
  it("posts the name to the source database's branch route and prints the branch", async () => {
    const branch = { database_id: "branch_1", database_name: "staging", root_database_id: "db_123", state: "creating" };
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(branch));
    const program = await createRedisProgram();

    const output = await runCommand(program, ["redis", "create-branch", "--db-id", "db_123", "--name", "staging"]);

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.upstash.com/v2/redis/database/db_123/branch");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ name: "staging" });
    expect(output).toEqual(branch);
  });
});
