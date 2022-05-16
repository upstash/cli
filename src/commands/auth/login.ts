import { Command } from "../../util/command.ts";
import { DEFAULT_CONFIG_PATH, loadConfig } from "../../config.ts";
export const loginCmd = new Command()
  .name("login")
  .description(
    `Log into your upstash account.
This will store your email and api key in ${DEFAULT_CONFIG_PATH}.
you can override this with "--config=/path/to/.upstash.json"`,
  )
  .option("-e, --email=<string>", "The email you use in upstash console")
  .option(
    "-k, --api-key=<string>",
    "Management api apiKey from https://console.upstash.com/account/api",
  )
  .action((options): void => {
    const config = loadConfig(options.config);
    if (config) {
      throw new Error(
        `You are already logged in, please log out first or delete ${options.config}`,
      );
    }
    let email = options.upstashEmail;
    if (!email) {
      email = options.upstashEmail;
    }
    // if (!email) {
    //   if (options.ci) {
    //     throw new cliffy.ValidationError("email");
    //   }
    //   email = await cliffy.Input.prompt("Enter your email");
    // }

    let apiKey = options.upstashToken;

    if (!apiKey) {
      apiKey = options.apiKey;
    }
    // if (!apiKey) {
    //   if (options.ci) {
    //     throw new cliffy.ValidationError("apiKey");
    //   }
    //   apiKey = await cliffy.Secret.prompt(
    //     "Enter your apiKey from https://console.upstash.com/account/api"
    //   );
    // }

    Deno.writeTextFileSync(options.config, JSON.stringify({ email, apiKey }));
  });
