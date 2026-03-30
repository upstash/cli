import { Command } from "commander";
import { registerSearchList } from "./list.js";
import { registerSearchCreate } from "./create.js";
import { registerSearchGet } from "./get.js";
import { registerSearchDelete } from "./delete.js";
import { registerSearchRename } from "./rename.js";
import { registerSearchResetPassword } from "./reset-password.js";
import { registerSearchTransfer } from "./transfer.js";
import { registerSearchStats } from "./stats.js";

export function registerSearch(program: Command): void {
  const search = program.command("search").description("Manage Search indexes");

  registerSearchList(search);
  registerSearchCreate(search);
  registerSearchGet(search);
  registerSearchDelete(search);
  registerSearchRename(search);
  registerSearchResetPassword(search);
  registerSearchTransfer(search);
  registerSearchStats(search);
}
