# Upstash CLI

[![GitHub release](https://img.shields.io/github/v/release/upstash/cli)](https://github.com/upstash/cli/releases/latest)
[![npm downloads](https://img.shields.io/npm/dw/upstash.svg)](https://npmjs.org/package/upstash)

Agent-friendly CLI for managing & debugging Upstash resources from your terminal. [Docs](https://upstash.com/docs/agent-resources/cli).

## Installation

Requires Node.js 20 or newer.

```bash
npm i -g upstash
```

The same build is also published as `@upstash/cli`, with the same version, so existing installs keep working.

For agents, pair the CLI with the [Upstash Skill](https://docs.upstash.com/agent-resources/skills), it bundles Upstash docs alongside docs for the `upstash` CLI.

```bash
npx skills add upstash/skills
```

## Connect your AI agent

One command wires Upstash into your coding agents:

```bash
npx upstash
```

With no arguments in a terminal, `upstash` runs `upstash setup`. From an agent or a script, a bare `upstash` prints the help instead, so run `upstash setup` explicitly there.

It picks the best install path per agent:

| Agent | What gets installed |
|---|---|
| Claude Code, Codex, Gemini CLI | The Upstash plugin via the agent's own CLI (MCP server + skills) |
| Cursor | The Upstash plugin as a local plugin in `~/.cursor/plugins/local/upstash` |
| VS Code, GitHub Copilot CLI, OpenCode | The remote MCP server in the agent's config, plus the `upstash` skill |

In a terminal it walks you through a few prompts: where to install (all projects or just this one) and which agents (detected ones are pre-selected). Flags answer a question up front; `-y` or `--json` skip the prompts entirely.

Agents are detected from their config directories, or chosen with flags (`--claude --cursor ...`). If a plugin can't be installed (for example the agent's CLI isn't on your `PATH`), setup falls back to MCP + skill for that agent.

```bash
upstash setup --claude --cursor -y        # no prompts
upstash setup --project                    # this repo instead of your user config
upstash setup --mode mcp                   # MCP + skill everywhere, no plugins
upstash setup --dry-run                    # show what would change
```

The MCP server signs in with OAuth: on first use your agent opens a consent page where you pick the account (turn read-only off if the agent should change resources). Setup never writes an API key into an agent's config. Rerunning `setup` updates what it installed.

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

Sign in through the browser once per machine:

```bash
upstash login --oauth
```

The consent page lets you pick a personal or team scope and whether the login is read-only. To switch teams, run it again. Team management commands (`team create`, `team delete`, `team add-member`, `team remove-member`) need an API key login.

Or grab a Developer API key from the [Upstash Console](https://console.upstash.com/account/api) and save it with `upstash login`, or set `UPSTASH_EMAIL` and `UPSTASH_API_KEY` in your shell or a `.env` file (recommended for CI and agents). `upstash whoami` shows which credentials are in use. See the [auth docs](https://upstash.com/docs/agent-resources/cli#authentication) for env files, per-command flags, and precedence rules.

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

# Blob
upstash blob create --name my-bucket --visibility private
upstash blob ls
upstash blob ls my-bucket
upstash blob cp ./assets blob://my-bucket/assets -r
upstash blob sync ./site blob://my-bucket/site -d
upstash blob credentials my-bucket

# Team
upstash team list
upstash team add-member --team-id $TEAM_ID --member-email you@example.com --role dev
```

Run `upstash --help` (or `--help` on any subcommand) to discover everything else, and check the [full docs](https://upstash.com/docs/agent-resources/cli) for the complete catalog. `upstash blob credentials` returns temporary S3 credentials for use with AWS CLI, rclone, or an S3 SDK.

## Working with Blob buckets and objects

The object commands mirror `aws s3`, with `blob://<bucket>/<key>` in place of
`s3://`. `<bucket>` is a bucket name or id.

```bash
upstash blob ls                                         # buckets
upstash blob ls my-bucket/images/                       # one level; -r for all
upstash blob cp ./photo.png blob://my-bucket/images/
upstash blob cp ./assets blob://my-bucket/assets -r
upstash blob cp blob://my-bucket/images ./images -r --exclude "*.tmp"
upstash blob cp blob://my-bucket/config.json - | jq .
upstash blob mv blob://my-bucket/a.txt blob://other-bucket/a.txt
upstash blob sync ./site blob://my-bucket/site -d
upstash blob rm my-bucket/tmp -r -n
upstash blob presign my-bucket/report.pdf --expires-in 600
upstash blob mb blob://new-bucket
upstash blob rb new-bucket -f
```

`cp`, `mv` and `sync` need `blob://` to tell bucket paths from local ones. The
commands that only take bucket paths (`ls`, `rm`, `presign`, `mb`, `rb`) accept
`my-bucket/key` without it, as do `get`, `delete` and `credentials`, which take a
bucket name or id.

Flags follow `aws s3`: `-r/--recursive`, `--exclude`/`--include` (applied in
order, last match wins), `-n/--dryrun`, `-d/--delete`, `--size-only`,
`--exact-timestamps`, `--content-type`, `--cache-control`, `--metadata`,
`--expected-size`, `--concurrency` and `-q/--quiet`. Copies between buckets reset
Cache-Control to the default unless `--cache-control` is given. Local symbolic
links are followed unless `--no-follow-symlinks` is given. Nothing is deleted
through a link to a directory: `mv` refuses such files and `sync -d` keeps them.

Progress goes to stderr and a JSON summary to stdout. Transfers retry transient
failures, keep going past a failed file, and exit unsuccessfully at the end. Large
files use multipart uploads, and the Blob SDK refreshes temporary S3 credentials
throughout, even between parts of one file.

### Using a bucket token instead of a login

Bucket names need an Upstash login. A Blob bucket token (`--token`, or
`UPSTASH_BLOB_TOKEN` in the environment or `.env`) works without one, but only for
its own bucket, addressed by id. A token is never used for a bucket it wasn't
issued for.

```bash
upstash blob cp ./assets blob://$BUCKET_ID/assets -r --token "$BLOB_TOKEN"
upstash --env-path ./uploads.env blob sync ./assets blob://$BUCKET_ID/assets
upstash blob credentials --token "$BLOB_TOKEN"
```

`--token` and `UPSTASH_BLOB_TOKEN` are each used only for their own bucket, so they
can point at different buckets. Exported environment variables take precedence
over values loaded from `.env` or `--env-path`.

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
