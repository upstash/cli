import { Command } from "../../../util/command.ts";
import { createCmd } from "./create.ts";
import { deleteCmd } from "./delete.ts";
import { reconfigureCmd } from "./reconfigure.ts";
import { getCmd } from "./get.ts";
import { statsCmd } from "./stats.ts";

const topicCmd = new Command()
  .description("Manage kafka topics")
  .globalOption("--json=[boolean:boolean]", "Return raw json response")
  .command("create", createCmd)
  .command("delete", deleteCmd)
  .command("get", getCmd)
  .command("reconfigure", reconfigureCmd)
  .command("stats", statsCmd);

topicCmd.reset().action(() => {
  topicCmd.showHelp();
});

export { topicCmd };
