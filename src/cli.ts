#!/usr/bin/env node
import { Command } from "commander";
import pkg from "../package.json" with { type: "json" };
const { version } = pkg;
import { registerRedis } from "./commands/redis/index.js";
import { registerTeam } from "./commands/team/index.js";
import { registerVector } from "./commands/vector/index.js";
import { registerSearch } from "./commands/search/index.js";
import { registerQStash } from "./commands/qstash/index.js";
import { handleError } from "./output.js";
import dotenv from "dotenv";

// Pre-scan argv for --env-path before Commander parses, so dotenv loads
// the right file before any command action reads process.env.
function findEnvPath(argv: string[]): string | undefined {
  const eq = argv.find((a) => a.startsWith("--env-path="));
  if (eq) return eq.slice("--env-path=".length);
  const i = argv.indexOf("--env-path");
  return i !== -1 ? argv[i + 1] : undefined;
}
const envFilePath = findEnvPath(process.argv);
const dotenvResult = dotenv.config(envFilePath ? { path: envFilePath } : undefined);
if (envFilePath && dotenvResult.error) {
  console.error(JSON.stringify({ error: `Could not load env file: ${envFilePath}` }));
  process.exit(1);
}

const program = new Command();

program
  .name("upstash")
  .description("Agent-friendly CLI for Upstash")
  .version(version)
  .option("--env-path <path>", "Path to a .env file to load credentials from")
  .option("--email <email>", "Upstash email (overrides UPSTASH_EMAIL)")
  .option("--api-key <key>", "Upstash API key (overrides UPSTASH_API_KEY)");

registerRedis(program);
registerTeam(program);
registerVector(program);
registerSearch(program);
registerQStash(program);

program.parseAsync().catch(handleError);
