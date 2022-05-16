import { Command } from "../../util/command.ts";
import { deleteConfig } from "../../config.ts";
export const logoutCmd = new Command()
  .name("logout")
  .description("Delete local configuration")
  .action((options): void => {
    try {
      deleteConfig(options.config);
      console.log("You have been logged out");
    } catch {
      console.log("You were not logged in");
    }
  });
