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

const program = new Command();

program
  .name("upstash")
  .description("Agent-friendly CLI for Upstash")
  .version(version);

registerRedis(program);
registerTeam(program);
registerVector(program);
registerSearch(program);
registerQStash(program);

program.parseAsync().catch(handleError);
