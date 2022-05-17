import { cliffy } from "../deps.ts";

type GlobalConfig = {
  upstashEmail?: string;
  upstashApiKey?: string;
  ci?: boolean;
  json?: boolean;
  config: string;
};

export class Command extends cliffy.Command<void, void, GlobalConfig> {}
