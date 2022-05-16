import { Command } from "../../util/command.ts";
import { clusterCmd } from "./cluster/mod.ts";
import { topicCmd } from "./topic/mod.ts";
const kafkaCmd = new Command()
  .description("Manage kafka clusters and topics")
  .command("cluster", clusterCmd as unknown as Command)
  .command("topic", topicCmd as unknown as Command);

kafkaCmd.reset().action(() => {
  kafkaCmd.showHelp();
});

export { kafkaCmd };
