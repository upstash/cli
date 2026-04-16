import { Command } from "commander";
import { registerQStashGet } from "./get.js";
import { registerQStashList } from "./list.js";
import { registerQStashRotateToken } from "./rotate-token.js";
import { registerQStashSetPlan } from "./set-plan.js";
import { registerQStashStats } from "./stats.js";
import { registerQStashIpv4 } from "./ipv4.js";
import { registerQStashMoveToTeam } from "./move-to-team.js";
import { registerQStashUpdateBudget } from "./update-budget.js";
import { registerQStashEnableProdpack } from "./enable-prodpack.js";
import { registerQStashDisableProdpack } from "./disable-prodpack.js";

export function registerQStash(program: Command): void {
  const qstash = program.command("qstash").description("Manage QStash instances");

  registerQStashGet(qstash);
  registerQStashList(qstash);
  registerQStashRotateToken(qstash);
  registerQStashSetPlan(qstash);
  registerQStashStats(qstash);
  registerQStashIpv4(qstash);
  registerQStashMoveToTeam(qstash);
  registerQStashUpdateBudget(qstash);
  registerQStashEnableProdpack(qstash);
  registerQStashDisableProdpack(qstash);
}
