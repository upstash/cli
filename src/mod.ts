import { authCmd } from "./commands/auth/mod.ts";
import { redisCmd } from "./commands/redis/mod.ts";
import { teamCmd } from "./commands/team/mod.ts";
import { Command } from "./util/command.ts";
import { cliffy } from "./deps.ts";
import { VERSION } from "./version.ts";
import { DEFAULT_CONFIG_PATH } from "./config.ts";
const cmd = new Command()
  .name("upstash")
  .version(VERSION)
  .description("Official cli for Upstash products")
  .globalEnv("UPSTASH_EMAIL=<string>", "The email you use on upstash")
  .globalEnv("UPSTASH_API_KEY=<string>", "The api key from upstash")
  // .globalEnv(
  //   "CI=<boolean>",
  //   "Disable interactive prompts and throws an error instead",
  //   { hidden: true }
  // )
  // .globalOption(
  //   "--non-interactive [boolean]",
  //   "Disable interactive prompts and throws an error instead",
  //   { hidden: true }
  // )
  .globalOption("-c, --config=<string>", "Path to .upstash.json file", {
    default: DEFAULT_CONFIG_PATH,
  })
  /**
   * Nested commands don't seem to work as expected, or maybe I'm just not understanding them.
   * The workaround is to cast as `Command`
   */
  .command("auth", authCmd as unknown as Command)
  .command("redis", redisCmd as unknown as Command)
  .command("team", teamCmd as unknown as Command);
cmd.reset().action(() => {
  cmd.showHelp();
});

await cmd.parse(Deno.args).catch((err) => {
  if (err instanceof cliffy.ValidationError) {
    cmd.showHelp();
    console.error("Usage error: %s", err.message);
    Deno.exit(err.exitCode);
  } else {
    console.error(`Error: ${err.message}`);

    Deno.exit(1);
  }
});
