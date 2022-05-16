import { cliffy } from "../../deps.ts";
import { Command } from "../../util/command.ts";
import { loadConfig } from "../../config.ts";
export const whoamiCmd = new Command()
  .name("whoami")
  .description("Return the current users email")
  .action((options): void => {
    const config = loadConfig(options.config);
    if (!config) {
      throw new Error("You are not logged in, please run `upstash auth login`");
    }

    console.log(
      `Currently logged in as ${cliffy.colors.brightGreen(config.email)}`,
    );
  });
