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

/** https://code.claude.com/docs/en/env-vars (`CLAUDE_CONFIG_DIR`) */
function claudeConfigDir(): string {
  return process.env.CLAUDE_CONFIG_DIR || home(".claude");
}

/**
 * The docs do not say where `.claude.json` goes under `CLAUDE_CONFIG_DIR`;
 * `claude mcp add --scope user` (v2.1.287) writes `$CLAUDE_CONFIG_DIR/.claude.json`.
 */
function claudeGlobalMcpPath(): string {
  const dir = process.env.CLAUDE_CONFIG_DIR;
  return dir ? join(dir, ".claude.json") : home(".claude.json");
}

/** https://code.visualstudio.com/docs/configure/settings#_settings-file-locations */
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

/** Only `opencode.json` / `opencode.jsonc` are documented; the dotted names are accepted for older setups. */
const OPENCODE_FILES = ["opencode.json", "opencode.jsonc", ".opencode.json", ".opencode.jsonc"];

/**
 * Where each agent keeps its MCP config and skills. Every entry links the
 * vendor docs its paths and entry shape come from; check them when an agent
 * changes its layout.
 */
export const AGENTS = {
  /**
   * MCP: https://code.claude.com/docs/en/mcp (user scope: ~/.claude.json, project scope: .mcp.json, `type: "http"` + `headers`)
   * Skills: https://code.claude.com/docs/en/skills
   * Plugins: https://code.claude.com/docs/en/plugins/cli-reference
   */
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
  /**
   * MCP: https://developers.openai.com/codex/mcp#configure-with-configtoml (`[mcp_servers.<name>]`, `url`, `http_headers`;
   * project .codex/config.toml loads only in trusted projects)
   * Skills: https://developers.openai.com/codex/skills (~/.agents/skills, .agents/skills)
   * Plugins: https://developers.openai.com/codex/cli/reference#codex-plugin
   */
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
  /**
   * MCP: https://cursor.com/docs/context/mcp#configuration-locations (~/.cursor/mcp.json, .cursor/mcp.json)
   * Skills: https://cursor.com/docs/context/skills#skill-directories
   * Plugins: https://cursor.com/docs/plugins#test-plugins-locally
   */
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
  /**
   * MCP: https://geminicli.com/docs/tools/mcp-server/#configuration-properties (`mcpServers`, `httpUrl`, `headers`)
   * Settings files: https://geminicli.com/docs/reference/configuration/#settings-files
   * Skills: https://geminicli.com/docs/cli/skills/#discovery-tiers
   * Extensions: https://geminicli.com/docs/extensions/reference/#install-an-extension
   */
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
  /**
   * MCP: https://code.visualstudio.com/docs/agents/reference/mcp-configuration#_configuration-file (top-level `servers`)
   * These docs now list .vscode/mcp.json and the user-profile mcp.json as deprecated in favour of
   * .mcp.json and ~/.copilot/mcp-config.json; VS Code still reads them:
   * https://code.visualstudio.com/docs/agent-customization/mcp-servers#_configure-the-mcpjson-file
   * Skills: https://code.visualstudio.com/docs/agent-customization/agent-skills
   */
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
  /**
   * MCP: https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers
   * (~/.copilot/mcp-config.json, project .mcp.json, `tools: ["*"]`)
   * Skills: https://docs.github.com/en/copilot/concepts/agents/about-agent-skills
   */
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
  /**
   * Config files: https://opencode.ai/docs/config#locations
   * MCP: https://opencode.ai/docs/mcp-servers#remote (`mcp`, `type: "remote"`)
   * Skills: https://opencode.ai/docs/skills#place-files
   */
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
