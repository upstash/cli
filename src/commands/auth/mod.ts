import { Command } from "../../util/command.ts";
import { loginCmd } from "./login.ts";
import { logoutCmd } from "./logout.ts";
import { whoamiCmd } from "./whoami.ts";
const authCmd = new Command();

authCmd
  .description("Login and logout")
  .command("login", loginCmd)
  .command("logout", logoutCmd)
  .command("whoami", whoamiCmd);

authCmd.reset().action(() => {
  authCmd.showHelp();
});

export { authCmd };
