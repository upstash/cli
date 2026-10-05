import { Command } from "commander";
import { deleteConfig, getConfigPath, readOAuth, readOAuthClient } from "../config.js";
import { revokeRefreshToken } from "../oauth/token.js";

export function registerLogout(program: Command): void {
  program
    .command("logout")
    .description("Delete saved credentials from the user config file. A browser login is also revoked on the server.")
    .action(async () => {
      const path = getConfigPath();
      const oauth = readOAuth();
      const client = readOAuthClient();
      let revoked = false;
      if (oauth && client) {
        try {
          await revokeRefreshToken(oauth.issuer, client.client_id, oauth.refresh_token);
          revoked = true;
        } catch (err) {
          const reason = err instanceof Error ? err.message : String(err);
          process.stderr.write(`Warning: could not revoke the login on the server (${reason}). Removing it locally anyway.\n`);
        }
      }
      const removed = deleteConfig();
      if (!removed) {
        console.log(`No saved credentials at ${path}`);
        return;
      }
      console.log(`Removed credentials at ${path}`);
      if (oauth) {
        if (revoked) console.log("The Upstash API stops accepting this login within about 10 minutes.");
        console.log("The CLI stays listed under https://console.upstash.com/account/oauth-clients until you remove it there.");
      }
    });
}
