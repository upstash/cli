# Upstash CLI

[![GitHub release](https://img.shields.io/github/v/release/upstash/cli)](https://github.com/upstash/cli/releases/latest)
[![npm downloads](https://img.shields.io/npm/dw/@upstash/cli.svg)](https://npmjs.org/package/@upstash/cli)

Agent-friendly CLI for managing & debugging Upstash resources from your terminal. [Docs](https://upstash.com/docs/agent-resources/cli).

## Installation

```bash
npm i -g @upstash/cli
```

For agents, pair the CLI with the [Upstash Skill](https://docs.upstash.com/agent-resources/skills), it bundles Upstash docs alongside docs for the `upstash` CLI.

```bash
npx skills add upstash/skills
```

## No account? Start with a free Redis

If you are an AI agent (or just want to try things out) and need a Redis DB to use or experiment with, you don't need an Upstash account:

```bash
upstash start-redis
```

This prints markdown with credentials and a quickstart. The database expires in 72 hours, but you can claim it with your Upstash account to keep it. Pass `--id <database-id>` to re-fetch the credentials of a database you created earlier. Every command that touches your Upstash account needs authentication — only `start-redis` and the `login`/`logout` credential helpers do not.

If you are an agent, identify yourself with `--user-agent` on every `start-redis` call, so we can see which agents are creating databases:

```bash
upstash start-redis --user-agent claude-code   # or cursor, codex, opencode, ...
```

## Authentication

Grab a Developer API key from the [Upstash Console](https://console.upstash.com/account/api), then save it once per machine:

```bash
upstash login
```

Or set `UPSTASH_EMAIL` and `UPSTASH_API_KEY` in your shell or a `.env` file. See the [auth docs](https://upstash.com/docs/agent-resources/cli#authentication) for env files, per-command flags, and precedence rules.

## Quick examples

Every command that returns account data outputs JSON, so you can pipe to `jq`. The exceptions are `start-redis`, which prints markdown, and `login`/`logout`, which print a plain-text confirmation. Use `--dry-run` to preview destructive commands.

```bash
# Redis
upstash start-redis  # free temporary DB, no account needed
upstash redis list
upstash redis create --name my-db --region us-east-1
upstash redis exec --db-url $URL --db-token $TOKEN GET key

# Vector
upstash vector list
upstash vector create --name my-index --region us-east-1 --similarity-function COSINE --dimension-count 1536

# Search
upstash search list
upstash search create --name my-search --region us-central1 --type DENSE

# QStash
upstash qstash list
upstash qstash stats --qstash-id $QSTASH_ID --period 7d

# Team
upstash team list
upstash team add-member --team-id $TEAM_ID --member-email you@example.com --role dev
```

Run `upstash --help` (or `--help` on any subcommand) to discover everything else, and check the [full docs](https://upstash.com/docs/agent-resources/cli) for the complete catalog.

## Telemetry

The CLI identifies itself to the Upstash API on each request, so we can see which
clients our endpoints are serving. It sends three headers and nothing else:

| Header | Example |
| --- | --- |
| `Upstash-Telemetry-Sdk` | `@upstash/cli@1.2.0` |
| `Upstash-Telemetry-Runtime` | `node@22.14.0` |
| `Upstash-Telemetry-Platform` | `darwin` |

That is the CLI version, the JS runtime, and the OS platform. No command
arguments, credentials, resource names, or file paths are collected.

To turn it off:

```bash
upstash telemetry disable   # saved to your config file
upstash telemetry status    # check the current setting
upstash telemetry enable    # turn it back on
```

Or set the environment variable every Upstash SDK honors, which also works from
a `.env` file and takes precedence over the saved setting:

```bash
export UPSTASH_DISABLE_TELEMETRY=1
```

Disabling telemetry never affects what the CLI can do. `upstash logout` keeps
the setting, so signing out does not quietly turn it back on.

## Contributing

```bash
npm install
npm run build
node dist/cli.js --help    # try your build
npm link                   # or expose it as `upstash` globally
```

Open an issue, send a PR, or join us on [Discord](https://discord.com/invite/w9SenAtbme).
