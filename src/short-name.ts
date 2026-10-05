/**
 * The CLI is published twice from the same build: as `@upstash/cli` and as
 * `upstash`, so `npx upstash` works. Under the short name, a bare `upstash`
 * in a terminal is the agent setup entry point. Outside a terminal (an agent,
 * a script, CI) it keeps the default help output, so it never rewrites agent
 * configs unasked.
 */
export const SHORT_NAME = "upstash";

export function withDefaultCommand(packageName: string, args: string[], interactive: boolean): string[] {
  if (packageName === SHORT_NAME && args.length === 0 && interactive) return ["setup"];
  return args;
}
