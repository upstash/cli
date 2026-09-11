import { createServer } from "node:http";
import { REDIRECT_PATH } from "./issuer.js";

export interface CallbackServer {
  redirectUri: string;
  code: Promise<string>;
  close(): void;
}

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

const page = (title: string, body: string) =>
  `<!doctype html><meta charset="utf-8"><title>Upstash CLI</title><body style="font-family:system-ui;margin:48px"><h1>${title}</h1><p>${escapeHtml(body)}</p></body>`;

function problemWith(q: URLSearchParams, expected: { state: string; issuer: string }): string | undefined {
  if (q.get("state") !== expected.state) return "the response did not match this login attempt (state mismatch)";
  const iss = q.get("iss");
  if (iss && iss !== expected.issuer) return `the response came from ${iss}, not ${expected.issuer}`;
  const error = q.get("error");
  if (error) return q.get("error_description") ?? error;
  if (!q.get("code")) return "the response had no authorization code";
  return undefined;
}

export function startCallbackServer(
  expected: { state: string; issuer: string },
  timeoutMs: number,
): Promise<CallbackServer> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let resolveCode!: (code: string) => void;
    let rejectCode!: (err: Error) => void;
    const code = new Promise<string>((res, rej) => {
      resolveCode = res;
      rejectCode = rej;
    });
    // The caller awaits later; a rejection before then must not be reported as unhandled.
    code.catch(() => {});
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      // Browser preconnects and favicon requests must not consume the callback.
      if (url.pathname !== REDIRECT_PATH || settled) {
        res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");
        return;
      }
      const problem = problemWith(url.searchParams, expected);
      if (problem) {
        res.writeHead(400, { "Content-Type": "text/html" }).end(page("Login failed", `${problem}. Return to the terminal.`));
        if (url.searchParams.get("state") !== expected.state) return;
        settled = true;
        rejectCode(new Error(`Login failed: ${problem}.`));
        return;
      }
      settled = true;
      res.writeHead(200, { "Content-Type": "text/html" }).end(page("You're logged in", "You can close this tab and return to the terminal."));
      resolveCode(url.searchParams.get("code") as string);
    });
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      rejectCode(new Error("Timed out waiting for the browser login. Run the command again."));
    }, timeoutMs);
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not open a local port for the login callback."));
        return;
      }
      resolve({
        redirectUri: `http://127.0.0.1:${address.port}${REDIRECT_PATH}`,
        code,
        close: () => {
          clearTimeout(timer);
          server.close();
        },
      });
    });
  });
}
