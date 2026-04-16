import { Command } from "commander";
import { createInterface } from "node:readline";
import { writeConfig } from "../config.js";
import { HttpError, request } from "../client.js";
import { plainError } from "../output.js";

export function registerLogin(program: Command): void {
  program
    .command("login")
    .description("Save Upstash credentials to the user config file. Uses --email/--api-key if provided, otherwise prompts interactively.")
    .action(async (_flags: unknown, command: Command) => {
      const globals = command.optsWithGlobals() as { email?: string; apiKey?: string };
      const email = globals.email ?? await promptLine("Upstash email: ");
      if (!globals.apiKey) {
        process.stderr.write("Create an API key at https://console.upstash.com/account/api\n");
      }
      const apiKey = globals.apiKey ?? await promptHidden("Upstash API key: ");

      if (!email) throw plainError("Email is required.");
      if (!apiKey) throw plainError("API key is required.");

      try {
        await request<unknown>({ email, apiKey }, "GET", "/v2/redis/databases");
      } catch (err) {
        if (err instanceof HttpError && (err.status === 401 || err.status === 403)) {
          throw plainError("Authentication failed: the email and API key combination is not valid.");
        }
        const reason = err instanceof Error ? err.message : String(err);
        throw plainError(`Could not verify credentials: ${reason}`);
      }

      const path = writeConfig({ email, apiKey });
      console.log(`Credentials verified and saved to ${path}`);
    });
}

function promptLine(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function promptHidden(question: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    const stderr = process.stderr;
    if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
      promptLine(question).then(resolve, reject);
      return;
    }
    stderr.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const onData = (chunk: string): void => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener("data", onData);
          stderr.write("\n");
          resolve(value);
          return;
        }
        if (ch === "\u0003") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener("data", onData);
          stderr.write("\n");
          process.exit(130);
        }
        if (ch === "\u007f" || ch === "\b") {
          if (value.length > 0) {
            value = value.slice(0, -1);
            stderr.write("\b \b");
          }
          continue;
        }
        value += ch;
        stderr.write("*");
      }
    };
    stdin.on("data", onData);
  });
}
