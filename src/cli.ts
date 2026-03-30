#!/usr/bin/env node
import { Command } from "commander";
import { registerAuth } from "./commands/auth/index.js";
import { registerRedis } from "./commands/redis/index.js";
import { registerTeam } from "./commands/team/index.js";
import { registerVector } from "./commands/vector/index.js";
import { registerSearch } from "./commands/search/index.js";
import { registerQStash } from "./commands/qstash/index.js";

const program = new Command();

program
  .name("upstash")
  .description("Agent-friendly CLI for Upstash")
  .version("1.0.0");

registerAuth(program);
registerRedis(program);
registerTeam(program);
registerVector(program);
registerSearch(program);
registerQStash(program);

program.parse();
