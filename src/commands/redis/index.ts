import { Command } from "commander";
import { registerCreate } from "./create.js";
import { registerList } from "./list.js";
import { registerGet } from "./get.js";
import { registerDelete } from "./delete.js";
import { registerRename } from "./rename.js";
import { registerResetPassword } from "./reset-password.js";
import { registerStats } from "./stats.js";
import { registerEnableTls } from "./enable-tls.js";
import { registerEnableEviction } from "./enable-eviction.js";
import { registerDisableEviction } from "./disable-eviction.js";
import { registerEnableAutoupgrade } from "./enable-autoupgrade.js";
import { registerDisableAutoupgrade } from "./disable-autoupgrade.js";
import { registerChangePlan } from "./change-plan.js";
import { registerUpdateBudget } from "./update-budget.js";
import { registerUpdateRegions } from "./update-regions.js";
import { registerMoveToTeam } from "./move-to-team.js";
import { registerBackup } from "./backup/index.js";

export function registerRedis(program: Command): void {
  const redis = program.command("redis").description("Manage Redis databases");

  registerCreate(redis);
  registerList(redis);
  registerGet(redis);
  registerDelete(redis);
  registerRename(redis);
  registerResetPassword(redis);
  registerStats(redis);
  registerEnableTls(redis);
  registerEnableEviction(redis);
  registerDisableEviction(redis);
  registerEnableAutoupgrade(redis);
  registerDisableAutoupgrade(redis);
  registerChangePlan(redis);
  registerUpdateBudget(redis);
  registerUpdateRegions(redis);
  registerMoveToTeam(redis);
  registerBackup(redis);
}
