/**
 * A bare `upstash` in a terminal is the agent setup entry point, so
 * `npx upstash` connects your coding agents. Outside a terminal (an agent, a
 * script, CI) it keeps the default help output, so it never rewrites agent
 * configs unasked.
 */
export function withDefaultCommand(args: string[], interactive: boolean): string[] {
  return args.length === 0 && interactive ? ["setup"] : args;
}
