import { Command } from "commander";

export async function createRedisProgram(): Promise<Command> {
  const { registerRedis } = await import("../../src/commands/redis/index.js");
  const p = new Command().exitOverride();
  registerRedis(p);
  return p;
}

export async function createVectorProgram(): Promise<Command> {
  const { registerVector } = await import("../../src/commands/vector/index.js");
  const p = new Command().exitOverride();
  registerVector(p);
  return p;
}

export async function createSearchProgram(): Promise<Command> {
  const { registerSearch } = await import("../../src/commands/search/index.js");
  const p = new Command().exitOverride();
  registerSearch(p);
  return p;
}

export async function createQStashProgram(): Promise<Command> {
  const { registerQStash } = await import("../../src/commands/qstash/index.js");
  const p = new Command().exitOverride();
  registerQStash(p);
  return p;
}

export async function createTeamProgram(): Promise<Command> {
  const { registerTeam } = await import("../../src/commands/team/index.js");
  const p = new Command().exitOverride();
  registerTeam(p);
  return p;
}

export async function runCommand(program: Command, argv: string[]): Promise<unknown> {
  const output: string[] = [];
  const errors: string[] = [];
  const origLog = console.log;
  const origError = console.error;
  const origExit = process.exit;

  console.log = (...args: unknown[]) => output.push(args.join(" "));
  console.error = (...args: unknown[]) => errors.push(args.join(" "));
  process.exit = ((code?: number) => {
    throw new Error(`CLI error (exit ${code ?? 1}): ${errors.at(-1) ?? "unknown error"}`);
  }) as typeof process.exit;

  try {
    await program.parseAsync(["node", "upstash", ...argv]);
  } finally {
    console.log = origLog;
    console.error = origError;
    process.exit = origExit;
  }

  const last = output.at(-1);
  return last ? JSON.parse(last) as unknown : null;
}
