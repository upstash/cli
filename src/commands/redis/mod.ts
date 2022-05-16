import { Command } from "../../util/command.ts";
import { createCmd } from "./create.ts";
import { listCmd } from "./list.ts";
import { deleteCmd } from "./delete.ts";
import { getCmd } from "./get.ts";
import { statsCmd } from "./stats.ts";
import { resetPasswordCmd } from "./reset_password.ts";
import { renameCmd } from "./rename.ts";
import { enableTLSCmd } from "./enable_tls.ts";
import { enableMultizoneReplicationCmd } from "./enable_multizone_replication.ts";
import { moveToTeamCmd } from "./move_to_team.ts";
const redisCmd = new Command()
  .description("Manage redis database instances")
  .globalOption("--json=<boolean:boolean>", "Return raw json response")
  .command("create", createCmd)
  .command("list", listCmd)
  .command("get", getCmd)
  .command("delete", deleteCmd)
  .command("stats", statsCmd)
  .command("rename", renameCmd)
  .command("reset-password", resetPasswordCmd)
  .command("enable-tls", enableTLSCmd)
  .command("enable-multizone-replication", enableMultizoneReplicationCmd)
  .command("move-to-team", moveToTeamCmd);

redisCmd.reset().action(() => {
  redisCmd.showHelp();
});

export { redisCmd };
