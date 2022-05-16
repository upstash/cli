import { Command } from "../../../util/command.ts";
import { createCmd } from "./create.ts";
import { listCmd } from "./list.ts";
import { renameCmd } from "./rename.ts";
import { deleteCmd } from "./delete.ts";
import { resetPasswordCmd } from "./reset_password.ts";
import { getCmd } from "./get.ts";
import { statsCmd } from "./stats.ts";
import { topicsCmd } from "./topics.ts";
const clusterCmd = new Command()
  .description("Manage kafka cluster")
  .globalOption("--json=<boolean:boolean>", "Return raw json response")
  .command("create", createCmd)
  .command("list", listCmd)
  .command("rename", renameCmd)
  .command("get", getCmd)
  .command("delete", deleteCmd)
  .command("reset", resetPasswordCmd)
  .command("stats", statsCmd)
  .command("topics", topicsCmd);

clusterCmd.reset().action(() => {
  clusterCmd.showHelp();
});

export { clusterCmd };
