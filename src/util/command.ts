import { cliffy } from "../deps.ts";

type GlobalConfig = {
  upstashEmail?: string;
  upstashToken?: string;
  ci?: boolean;
  json?: boolean;
  config: string;
};

export class Command extends cliffy.Command<void, void, GlobalConfig> {}
