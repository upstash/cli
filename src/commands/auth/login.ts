import { Command } from "../../util/command.ts";
import { DEFAULT_CONFIG_PATH, loadConfig } from "../../config.ts";
import { cliffy } from "../../deps.ts";
export const loginCmd = new Command()
  .name("login")
  .description(
    `Log into your upstash account.
This will store your email and api key in ${DEFAULT_CONFIG_PATH}.
you can override this with "--config=/path/to/.upstash.json"`,
  )
  .option("-e, --email=<email:string>", "The email you use in upstash console")
  .option(
    "-k, --api-key=<api-key:string>",
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
      email = options.email;
    }

    if (!email) {
      throw new cliffy.ValidationError(
        `email is missing, either use "--email" or set "UPSTASH_EMAIL" environment variable`,
      );
    }
    // if (!email) {
    //   if (options.ci) {
    //     throw new cliffy.ValidationError("email");
    //   }
    //   email = await cliffy.Input.prompt("Enter your email");
    // }

    let apiKey = options.upstashApiKey;

    if (!apiKey) {
      apiKey = options.apiKey;
    }
    if (!apiKey) {
      throw new cliffy.ValidationError(
        `api key is missing, either use "--api-key" or set "UPSTASH_API_KEY" environment variable`,
      );
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
