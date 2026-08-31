import pkg from "../package.json" with { type: "json" };

function runtime(): string {
  if (process.versions.bun) return `bun@${process.versions.bun}`;
  if (process.versions.deno) return `deno@${process.versions.deno}`;
  return `node@${process.versions.node}`;
}

export const telemetryHeaders: Record<string, string> = {
  "Upstash-Telemetry-Sdk": `@upstash/cli@${pkg.version}`,
  "Upstash-Telemetry-Runtime": runtime(),
  "Upstash-Telemetry-Platform": process.platform,
};
