import { afterEach, describe, expect, it, vi } from "vitest";
import { Command } from "commander";
import { registerStartRedis } from "../../src/commands/start-redis.js";

const MARKDOWN = "# Your Redis is ready\n\n**Endpoint:** https://example.upstash.io\n";

function createProgram(): Command {
  const program = new Command().exitOverride();
  registerStartRedis(program);
  return program;
}

async function run(argv: string[]): Promise<string[]> {
  const output: string[] = [];
  const origLog = console.log;
  console.log = (...args: unknown[]) => output.push(args.join(" "));
  try {
    await createProgram().parseAsync(["node", "upstash", ...argv]);
  } finally {
    console.log = origLog;
  }
  return output;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("start-redis", () => {
  it("POSTs without credentials and prints the markdown response", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(MARKDOWN, { status: 200 }));

    const output = await run(["start-redis"]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://upstash.com/start-redis");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({ "User-Agent": "upstash/cli" });
    expect(output).toEqual([MARKDOWN.trimEnd()]);
  });

  it("sends the database id as an idempotency key when --id is given", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(MARKDOWN, { status: 200 }));

    await run(["start-redis", "--id", "db-123"]);

    const [, init] = fetchMock.mock.calls[0]!;
    expect(init?.headers).toEqual({
      "Idempotency-Key": "db-123",
      "User-Agent": "upstash/cli",
    });
  });

  it("sends the caller name as a user agent when --user-agent is given", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(MARKDOWN, { status: 200 }));

    await run(["start-redis", "--user-agent", "claude-code"]);

    const [, init] = fetchMock.mock.calls[0]!;
    expect(init?.headers).toEqual({ "User-Agent": "claude-code" });
  });

  it("sends both headers when --id and --user-agent are given", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(MARKDOWN, { status: 200 }));

    await run(["start-redis", "--id", "db-123", "--user-agent", "cursor"]);

    const [, init] = fetchMock.mock.calls[0]!;
    expect(init?.headers).toEqual({
      "Idempotency-Key": "db-123",
      "User-Agent": "cursor",
    });
  });

  it("throws a plain error when the network is unreachable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("getaddrinfo ENOTFOUND"));

    await expect(run(["start-redis"])).rejects.toThrow(
      "Could not reach https://upstash.com/start-redis: getaddrinfo ENOTFOUND",
    );
  });

  it("throws a plain error when the request fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("rate limited", { status: 429 }),
    );

    await expect(run(["start-redis"])).rejects.toThrow("rate limited");
  });
});
