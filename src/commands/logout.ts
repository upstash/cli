import { Command } from "commander";
import { deleteConfig, getConfigPath } from "../config.js";

export function registerLogout(program: Command): void {
  program
    .command("logout")
    .description("Delete saved credentials from the user config file.")
    .action(() => {
      const path = getConfigPath();
      const removed = deleteConfig();
      if (removed) {
        console.log(`Removed credentials at ${path}`);
      } else {
        console.log(`No saved credentials at ${path}`);
      }
    });
}
