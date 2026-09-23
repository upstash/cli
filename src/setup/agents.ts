import { homedir } from "node:os";
import { join } from "node:path";

export const MCP_URL = "https://mcp.upstash.com/mcp";
export const SERVER_NAME = "upstash";
export const SKILL_NAME = "upstash";
export const SKILLS_REPO = "upstash/skills";
export const PLUGIN_ID = "upstash@upstash";

export type Scope = "global" | "project";

/** `token` is the `email:API_KEY` pair the remote MCP accepts as a bearer token. */
export type McpAuth = { mode: "oauth" } | { mode: "api-key"; token: string };

export type PluginKind = "claude" | "codex" | "cursor" | "gemini";

export interface AgentConfig {
  displayName: string;
  /** Set when the agent can install the upstash/skills plugin (skills + MCP in one step). */
  plugin?: { kind: PluginKind; scopes: Scope[] };
  mcp: {
    format: "json" | "toml";
    /** Candidate config files; the first that exists wins, otherwise the first is created. */
    paths: (scope: Scope) => string[];
    configKey: string;
    buildEntry: (auth: McpAuth) => Record<string, unknown>;
  };
  /** Directory the `upstash` skill folder is written into. */
  skillDir: (scope: Scope) => string;
  /** Paths whose existence means the agent is in use. */
  detect: (scope: Scope) => string[];
}

const home = (...parts: string[]): string => join(homedir(), ...parts);
const cwd = (...parts: string[]): string => join(process.cwd(), ...parts);
const pick = (scope: Scope, project: string, global: string): string =>
  scope === "project" ? cwd(project) : global;

function claudeConfigDir(): string {
  return process.env.CLAUDE_CONFIG_DIR || home(".claude");
}

function claudeGlobalMcpPath(): string {
  const dir = process.env.CLAUDE_CONFIG_DIR;
  return dir ? join(dir, ".claude.json") : home(".claude.json");
}

export function vscodeUserDir(platform: NodeJS.Platform = process.platform): string {
  if (platform === "win32") {
    return join(process.env.APPDATA || home("AppData", "Roaming"), "Code", "User");
  }
  if (platform === "darwin") return home("Library", "Application Support", "Code", "User");
  return join(process.env.XDG_CONFIG_HOME || home(".config"), "Code", "User");
}

/**
 * The header must be named `Authorization`: Codex decides a server's auth mode
 * from that name, and anything else reads as "no credential" and falls back to
 * OAuth.
 */
function withAuth(
  entry: Record<string, unknown>,
  auth: McpAuth,
  key = "headers",
): Record<string, unknown> {
  if (auth.mode !== "api-key") return entry;
  return { ...entry, [key]: { Authorization: `Bearer ${auth.token}` } };
}

const OPENCODE_FILES = ["opencode.json", "opencode.jsonc", ".opencode.json", ".opencode.jsonc"];

export const AGENTS = {
  claude: {
    displayName: "Claude Code",
    plugin: { kind: "claude", scopes: ["global", "project"] },
    mcp: {
      format: "json",
      paths: (s) => [s === "project" ? cwd(".mcp.json") : claudeGlobalMcpPath()],
      configKey: "mcpServers",
      buildEntry: (auth) => withAuth({ type: "http", url: MCP_URL }, auth),
    },
    skillDir: (s) => pick(s, join(".claude", "skills"), join(claudeConfigDir(), "skills")),
    detect: (s) => (s === "project" ? [cwd(".mcp.json"), cwd(".claude")] : [claudeConfigDir()]),
  },
  codex: {
    displayName: "Codex",
    plugin: { kind: "codex", scopes: ["global"] },
    mcp: {
      format: "toml",
      paths: (s) => [pick(s, join(".codex", "config.toml"), home(".codex", "config.toml"))],
      configKey: "mcp_servers",
      buildEntry: (auth) => withAuth({ url: MCP_URL }, auth, "http_headers"),
    },
    skillDir: (s) => pick(s, join(".agents", "skills"), home(".agents", "skills")),
    detect: (s) => [pick(s, ".codex", home(".codex"))],
  },
  cursor: {
    displayName: "Cursor",
    plugin: { kind: "cursor", scopes: ["global"] },
    mcp: {
      format: "json",
      paths: (s) => [pick(s, join(".cursor", "mcp.json"), home(".cursor", "mcp.json"))],
      configKey: "mcpServers",
      buildEntry: (auth) => withAuth({ url: MCP_URL }, auth),
    },
    skillDir: (s) => pick(s, join(".cursor", "skills"), home(".cursor", "skills")),
    detect: (s) => [pick(s, ".cursor", home(".cursor"))],
  },
  gemini: {
    displayName: "Gemini CLI",
    plugin: { kind: "gemini", scopes: ["global"] },
    mcp: {
      format: "json",
      paths: (s) => [pick(s, join(".gemini", "settings.json"), home(".gemini", "settings.json"))],
      configKey: "mcpServers",
      buildEntry: (auth) => withAuth({ httpUrl: MCP_URL }, auth),
    },
    skillDir: (s) => pick(s, join(".gemini", "skills"), home(".gemini", "skills")),
    detect: (s) => [pick(s, ".gemini", home(".gemini"))],
  },
  vscode: {
    displayName: "VS Code",
    mcp: {
      format: "json",
      paths: (s) => [pick(s, join(".vscode", "mcp.json"), join(vscodeUserDir(), "mcp.json"))],
      configKey: "servers",
      buildEntry: (auth) => withAuth({ type: "http", url: MCP_URL }, auth),
    },
    skillDir: (s) => pick(s, join(".agents", "skills"), home(".agents", "skills")),
    detect: (s) => [pick(s, ".vscode", vscodeUserDir())],
  },
  copilot: {
    displayName: "GitHub Copilot CLI",
    mcp: {
      format: "json",
      paths: (s) => [pick(s, ".mcp.json", home(".copilot", "mcp-config.json"))],
      configKey: "mcpServers",
      buildEntry: (auth) => withAuth({ type: "http", url: MCP_URL, tools: ["*"] }, auth),
    },
    skillDir: (s) => pick(s, join(".agents", "skills"), home(".agents", "skills")),
    // Copilot shares .mcp.json with Claude Code, so a project cannot be
    // attributed to it; --copilot still works explicitly.
    detect: (s) => (s === "project" ? [] : [home(".copilot")]),
  },
  opencode: {
    displayName: "OpenCode",
    mcp: {
      format: "json",
      paths: (s) =>
        OPENCODE_FILES.map((f) => (s === "project" ? cwd(f) : home(".config", "opencode", f))),
      configKey: "mcp",
      buildEntry: (auth) => withAuth({ type: "remote", url: MCP_URL, enabled: true }, auth),
    },
    skillDir: (s) => pick(s, join(".agents", "skills"), home(".config", "opencode", "skills")),
    detect: (s) =>
      s === "project" ? OPENCODE_FILES.map((f) => cwd(f)) : [home(".config", "opencode")],
  },
} satisfies Record<string, AgentConfig>;

export type AgentName = keyof typeof AGENTS;
export const AGENT_NAMES = Object.keys(AGENTS) as AgentName[];

export function getAgent(name: AgentName): AgentConfig {
  return AGENTS[name];
}
