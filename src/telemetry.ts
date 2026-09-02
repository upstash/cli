import pkg from "../package.json" with { type: "json" };
import { getConfigPath, readTelemetryDisabled } from "./config.js";

function runtime(): string {
  if (process.versions.bun) return `bun@${process.versions.bun}`;
  if (process.versions.deno) return `deno@${process.versions.deno}`;
  return `node@${process.versions.node}`;
}

function isSet(value: string | undefined): boolean {
  return value !== undefined && value !== "" && value !== "0" && value !== "false";
}

/**
 * `UPSTASH_DISABLE_TELEMETRY` is the variable the Upstash SDKs already read. It
 * wins over the saved preference so a CI job can opt out without writing config.
 */
export function telemetryStatus(): { enabled: boolean; disabled_by?: string } {
  if (isSet(process.env.UPSTASH_DISABLE_TELEMETRY)) {
    return { enabled: false, disabled_by: "UPSTASH_DISABLE_TELEMETRY" };
  }
  if (readTelemetryDisabled()) return { enabled: false, disabled_by: getConfigPath() };
  return { enabled: true };
}

/**
 * Resolved per request rather than at import: `cli.ts` loads the .env file
 * after the module graph is already evaluated, so an env var read at import
 * time would miss it.
 */
export function telemetryHeaders(): Record<string, string> {
  if (!telemetryStatus().enabled) return {};
  return {
    "Upstash-Telemetry-Sdk": `@upstash/cli@${pkg.version}`,
    "Upstash-Telemetry-Runtime": runtime(),
    "Upstash-Telemetry-Platform": process.platform,
  };
}
