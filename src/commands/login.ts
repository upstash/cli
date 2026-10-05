import { Command } from "commander";
import { createInterface } from "node:readline";
import { envApiKeyAuth } from "../auth.js";
import { clearOAuthClient, getConfigPath, writeConfig, writeOAuth } from "../config.js";
import { fetchTokenInfo, HttpError, request } from "../client.js";
import { plainError } from "../output.js";
import { openBrowser } from "../oauth/browser.js";
import { issuerUrl, SCOPE } from "../oauth/issuer.js";
import { startCallbackServer } from "../oauth/loopback.js";
import { generatePkce } from "../oauth/pkce.js";
import { ensureClient } from "../oauth/register.js";
import { exchangeCode, OAuthError } from "../oauth/token.js";

const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

export function registerLogin(program: Command): void {
  program
    .command("login")
    .description(
      "Save Upstash credentials to the user config file. Uses --email/--api-key if provided, otherwise prompts for an API key. With --oauth, signs in through the browser instead.",
    )
    .option("--oauth", "Sign in through the browser with your Upstash account instead of an API key")
    .option("--no-browser", "With --oauth: print the login URL instead of opening a browser")
    .action(async (flags: { oauth?: boolean; browser: boolean }, command: Command) => {
      const globals = command.optsWithGlobals() as { email?: string; apiKey?: string };
      if (flags.oauth) {
        await oauthLogin(flags.browser);
        return;
      }
      const email = globals.email ?? await promptLine("Upstash email: ");
      if (!globals.apiKey) {
        process.stderr.write("Create an API key at https://console.upstash.com/account/api\n");
      }
      const apiKey = globals.apiKey ?? await promptHidden("Upstash API key: ");

      if (!email) throw plainError("Email is required.");
      if (!apiKey) throw plainError("API key is required.");

      try {
        await request<unknown>({ kind: "api-key", email, apiKey }, "GET", "/v2/redis/databases");
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

async function oauthLogin(useBrowser: boolean): Promise<void> {
  const env = envApiKeyAuth();
  if (env.email || env.apiKey) {
    process.stderr.write("Warning: UPSTASH_EMAIL / UPSTASH_API_KEY are set and will override this login until unset.\n");
  }
  if (process.env.CI && !process.stdin.isTTY) {
    throw plainError("Browser login needs an interactive terminal. In CI, set UPSTASH_EMAIL and UPSTASH_API_KEY instead.");
  }

  const issuer = issuerUrl();
  const client = await ensureClient(issuer);
  const pkce = generatePkce();
  const server = await startCallbackServer({ state: pkce.state, issuer }, LOGIN_TIMEOUT_MS);

  try {
    const url = new URL(`${issuer}/oauth/authorize`);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", client.client_id);
    url.searchParams.set("redirect_uri", server.redirectUri);
    url.searchParams.set("scope", SCOPE);
    url.searchParams.set("state", pkce.state);
    url.searchParams.set("code_challenge", pkce.challenge);
    url.searchParams.set("code_challenge_method", "S256");

    const opened = useBrowser && (await openBrowser(url.toString()));
    process.stderr.write(
      opened
        ? `Opened your browser to sign in. If it did not open, visit:\n${url}\n`
        : `Open this URL in your browser to sign in:\n${url}\n`,
    );

    const code = await server.code;
    let tokens;
    try {
      tokens = await exchangeCode({
        issuer,
        clientId: client.client_id,
        code,
        redirectUri: server.redirectUri,
        verifier: pkce.verifier,
      });
    } catch (err) {
      if (err instanceof OAuthError && err.code === "invalid_client") {
        clearOAuthClient();
        throw plainError("The saved login client was rejected by the server; run `upstash login --oauth` again to register a new one.");
      }
      throw err;
    }
    writeOAuth(tokens);

    const info = await fetchTokenInfo(tokens.access_token);
    const scope = info.team_id ? `team ${info.team_id}${info.team_role ? ` as ${info.team_role}` : ""}` : "personal account";
    console.log(`Logged in as ${info.email} (${scope}${info.read_only ? ", read-only" : ""}); saved to ${getConfigPath()}`);
  } finally {
    server.close();
  }
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
