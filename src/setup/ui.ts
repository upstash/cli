import * as p from "@clack/prompts";
import { homedir } from "node:os";
import type { Readable, Writable } from "node:stream";
import pc from "picocolors";
import type { Step } from "./plugins.js";

/** Streams the interactive UI reads and writes; swappable in tests. */
export interface PromptIO {
  input?: Readable;
  output?: Writable;
}

let io: PromptIO = {};
export function setPromptIO(next: PromptIO): void {
  io = next;
}
export function promptIO(): PromptIO {
  return io;
}

export class SetupCancelled extends Error {
  constructor() {
    super("Setup cancelled.");
  }
}

/** Unwraps a prompt answer, turning Ctrl+C / Esc into a SetupCancelled throw. */
function answer<T>(value: T | symbol): T {
  if (p.isCancel(value)) throw new SetupCancelled();
  return value as T;
}

export interface Choice<T> {
  value: T;
  label: string;
  hint?: string;
}

export async function pickMany<T>(message: string, options: Choice<T>[], initial: T[]): Promise<T[]> {
  return answer(
    await p.multiselect<T>({
      ...io,
      message,
      options: options as p.Option<T>[],
      initialValues: initial,
      required: true,
    }),
  );
}

export async function pickOne<T>(message: string, options: Choice<T>[], initial?: T): Promise<T> {
  return answer(await p.select<T>({ ...io, message, options: options as p.Option<T>[], initialValue: initial }));
}

export async function confirm(message: string): Promise<boolean> {
  return answer(await p.confirm({ ...io, message, initialValue: true }));
}

export async function askText(message: string, opts: { placeholder?: string; secret?: boolean } = {}): Promise<string> {
  const validate = (v: string | undefined): string | undefined => (v?.trim() ? undefined : "Required");
  const value = opts.secret
    ? await p.password({ ...io, message, validate })
    : await p.text({ ...io, message, placeholder: opts.placeholder, validate });
  return answer(value).trim();
}

export const intro = (title: string): void => p.intro(pc.bgCyan(pc.black(` ${title} `)), io);
export const outro = (message: string): void => p.outro(message, io);
export const cancelled = (message: string): void => p.cancel(message, io);
export const note = (message: string, title: string): void => p.note(message, title, io);
export const info = (message: string): void => p.log.info(message, io);
export const warn = (message: string): void => p.log.warn(message, io);
export const spinner = (): p.SpinnerResult => p.spinner(io);

/** `/home/me/.cursor/mcp.json` → `~/.cursor/mcp.json`. */
export function tildify(path: string): string {
  const home = homedir();
  return path === home || path.startsWith(home + "/") || path.startsWith(home + "\\")
    ? "~" + path.slice(home.length)
    : path;
}

const STEP_ICON: Record<Step["status"], string> = {
  done: pc.green("✓"),
  planned: pc.cyan("○"),
  failed: pc.red("✗"),
};

/** Word-wraps to the terminal so long notes stay inside the guide rail. */
function wrap(text: string, indent: string): string[] {
  const width = Math.max(40, ((io.output as { columns?: number } | undefined)?.columns ?? process.stdout.columns ?? 80) - 6);
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && line.length + 1 + word.length > width - indent.length) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines.map((l, i) => (i === 0 ? l : indent + l));
}

/** One agent's steps and notes, rendered under its spinner line. */
export function printSteps(steps: Step[], notes: string[]): void {
  const lines: string[] = [];
  for (const s of steps) {
    lines.push(`${STEP_ICON[s.status]} ${s.label}${s.path ? pc.dim(` → ${tildify(s.path)}`) : ""}`);
    if (s.detail) lines.push(`  ${pc.red(s.detail)}`);
  }
  for (const n of notes) {
    const [first = "", ...rest] = wrap(n, "  ");
    lines.push(`${pc.yellow("!")} ${pc.yellow(first)}`, ...rest.map((l) => pc.yellow(l)));
  }
  if (lines.length > 0) p.log.message(lines, { ...io, symbol: pc.gray("│"), spacing: 0 });
}

export const dim = pc.dim;
export const bold = pc.bold;
export const cyan = pc.cyan;
