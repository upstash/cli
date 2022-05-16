import { path } from "./deps.ts";
export type Config = {
  email: string;
  apiKey: string;
};
const homeDir = Deno.env.get("HOME");
const fileName = ".upstash.json";
export const DEFAULT_CONFIG_PATH = homeDir
  ? path.join(homeDir, fileName)
  : fileName;

export function loadConfig(path: string): Config | null {
  try {
    return JSON.parse(Deno.readTextFileSync(path)) as Config;
  } catch {
    return null;
  }
}

export function storeConfig(path: string, config: Config): void {
  Deno.writeTextFileSync(path, JSON.stringify(config));
}

export function deleteConfig(path: string): void {
  Deno.removeSync(path);
}
