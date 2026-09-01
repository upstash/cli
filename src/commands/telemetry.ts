import { Command } from "commander";
import { writeTelemetryDisabled } from "../config.js";
import { telemetryStatus } from "../telemetry.js";
import { printJSON } from "../output.js";

export function registerTelemetry(program: Command): void {
  const telemetry = program
    .command("telemetry")
    .description(
      "Show or change whether the CLI identifies itself to Upstash. It sends the CLI version, the JS runtime, and the OS platform — never command arguments, credentials, or resource names.",
    );

  telemetry
    .command("status")
    .description("Report whether telemetry is enabled, and what turned it off")
    .action(() => {
      printJSON(telemetryStatus());
    });

  telemetry
    .command("disable")
    .description("Stop sending telemetry headers, saved to the user config file")
    .action(() => {
      const path = writeTelemetryDisabled(true);
      console.log(`Telemetry disabled, saved to ${path}`);
    });

  telemetry
    .command("enable")
    .description("Resume sending telemetry headers, saved to the user config file")
    .action(() => {
      const path = writeTelemetryDisabled(false);
      console.log(`Telemetry enabled, saved to ${path}`);
      if (!telemetryStatus().enabled) {
        console.log("Still disabled by UPSTASH_DISABLE_TELEMETRY: unset it to take effect.");
      }
    });
}
