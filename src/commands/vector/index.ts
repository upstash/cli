import { Command } from "commander";
import { registerVectorList } from "./list.js";
import { registerVectorCreate } from "./create.js";
import { registerVectorGet } from "./get.js";
import { registerVectorDelete } from "./delete.js";
import { registerVectorRename } from "./rename.js";
import { registerVectorResetPassword } from "./reset-password.js";
import { registerVectorSetPlan } from "./set-plan.js";
import { registerVectorTransfer } from "./transfer.js";
import { registerVectorStats } from "./stats.js";

export function registerVector(program: Command): void {
  const vector = program.command("vector").description("Manage Vector indexes");

  registerVectorList(vector);
  registerVectorCreate(vector);
  registerVectorGet(vector);
  registerVectorDelete(vector);
  registerVectorRename(vector);
  registerVectorResetPassword(vector);
  registerVectorSetPlan(vector);
  registerVectorTransfer(vector);
  registerVectorStats(vector);
}
