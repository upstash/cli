import { Command } from "commander";
import { saveAuth, clearAuth, resolveAuth } from "../../auth.js";
import { printJSON } from "../../output.js";

export function registerAuth(program: Command): void {
  const auth = program.command("auth").description("Manage authentication credentials");

  auth
    .command("login")
    .description("Save credentials to ~/.upstash.json")
    .requiredOption("--email <email>", "Upstash email address")
    .requiredOption("--api-key <key>", "Upstash API key")
    .option("--json", "Output as JSON")
    .action((flags: { email: string; apiKey: string; json?: boolean }) => {
      saveAuth(flags.email, flags.apiKey);
      if (flags.json) {
        printJSON({ success: true, email: flags.email });
        return;
      }
      console.log(`Logged in as ${flags.email}`);
    });

  auth
    .command("logout")
    .description("Clear saved credentials from ~/.upstash.json")
    .option("--json", "Output as JSON")
    .action((flags: { json?: boolean }) => {
      clearAuth();
      if (flags.json) {
        printJSON({ success: true });
        return;
      }
      console.log("Logged out.");
    });

  auth
    .command("whoami")
    .description("Show the currently authenticated email")
    .option("--json", "Output as JSON")
    .action((flags: { json?: boolean }) => {
      const creds = resolveAuth({});
      if (flags.json) {
        printJSON({ email: creds.email });
        return;
      }
      console.log(`Logged in as ${creds.email}`);
    });
}
