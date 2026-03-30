# Upstash CLI

Manage Upstash services from the terminal or automation via the [Upstash Developer API](https://docs.upstash.com/redis/howto/developerapi). Commands are non-interactive; successful output on stdout is always JSON (parse with `jq` or similar). Errors go to stderr as `{ "error": "..." }` with exit code 1.

![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/upstash/cli)
[![Downloads/week](https://img.shields.io/npm/dw/lstr.svg)](https://npmjs.org/package/@upstash/cli)

**Agent reference:** [`CLAUDE.md`](./CLAUDE.md) (Cursor rules). Full CLI catalog for agents also lives at [`.agents/skills/upstash-cli/SKILL.md`](./.agents/skills/upstash-cli/SKILL.md).

## Installation

```bash
npm i -g @upstash/cli
```

The `upstash` binary is on your `PATH`.

Prebuilt binaries (Windows, Linux, macOS Intel and Apple Silicon) are on [GitHub Releases](https://github.com/upstash/cli/releases/latest).

## Authentication

Set both variables before running commands:

```bash
export UPSTASH_EMAIL=you@example.com
export UPSTASH_API_KEY=your_api_key
```

Most commands also accept `--email` and `--api-key`, which override the environment for that invocation.

For agents, a **read-only** Developer API key is often enough: the API only returns what that key allows, and only those operations succeed—mutations fail at the API like in the console.

See [how to get an API key](https://docs.upstash.com/redis/howto/developerapi#api-development).

## Global flags

These flags are accepted on commands that call the API:

| Flag | Description |
|------|-------------|
| `--email <email>` | Upstash email (overrides `UPSTASH_EMAIL`) |
| `--api-key <key>` | Upstash API key (overrides `UPSTASH_API_KEY`) |

Scoped commands use explicit resource flags with a shared placeholder: `--db-id <id>`, `--index-id <id>`, `--qstash-id <id>`, `--team-id <id>` (see `--help` on each command).

## Top-level commands

```text
upstash redis   # Redis databases
upstash team    # Teams and members
upstash vector  # Vector indexes
upstash search  # Search indexes
upstash qstash  # QStash instances
```

```bash
upstash --help
upstash redis --help
```

## Output format

- **Resource payload:** e.g. `{ "database_id": "...", "state": "active", ... }`
- **Boolean success:** `{ "success": true, ... }`
- **Delete:** `{ "deleted": true, ... }`
- **Error (exit code 1):** `{ "error": "message" }` on stderr

## Redis commands

### Execute via REST (`redis exec` does not use the Developer API key)

```bash
upstash redis exec --db-url <url> --db-token <token> --command "SET key value"
upstash redis exec --db-url <url> --db-token <token> --command "GET key"
```

Use `endpoint` / `https://...` and `rest_token` from `upstash redis get --db-id <id>`.

### Core

```bash
upstash redis list
upstash redis get --db-id <id>
upstash redis get --db-id <id> --hide-credentials
upstash redis create --name <name> --region <region>
upstash redis create --name <name> --region <region> --read-regions <r1> <r2>
upstash redis delete --db-id <id> --dry-run
upstash redis delete --db-id <id>
upstash redis rename --db-id <id> --name <new-name>
upstash redis reset-password --db-id <id>
upstash redis stats --db-id <id>
```

**Regions — AWS:** `us-east-1`, `us-east-2`, `us-west-1`, `us-west-2`, `ca-central-1`, `eu-central-1`, `eu-west-1`, `eu-west-2`, `sa-east-1`, `ap-south-1`, `ap-northeast-1`, `ap-southeast-1`, `ap-southeast-2`, `af-south-1`  
**Regions — GCP:** `us-central1`, `us-east4`, `europe-west1`, `asia-northeast1`

### Configuration

```bash
upstash redis enable-tls --db-id <id>
upstash redis enable-eviction --db-id <id>
upstash redis disable-eviction --db-id <id>
upstash redis enable-autoupgrade --db-id <id>
upstash redis disable-autoupgrade --db-id <id>
upstash redis change-plan --db-id <id> --plan <plan>   # free, payg, pro, paid
upstash redis update-budget --db-id <id> --budget <cents>
upstash redis update-regions --db-id <id> --read-regions <r1> <r2>
upstash redis move-to-team --db-id <id> --team-id <id>
```

### Backups

```bash
upstash redis backup list --db-id <id>
upstash redis backup create --db-id <id> --name <name>
upstash redis backup delete --db-id <id> --backup-id <id> --dry-run
upstash redis backup delete --db-id <id> --backup-id <id>
upstash redis backup restore --db-id <id> --backup-id <id>
upstash redis backup enable-daily --db-id <id>
upstash redis backup disable-daily --db-id <id>
```

## Team commands

```bash
upstash team list
upstash team create --name <name>
upstash team create --name <name> --copy-cc
upstash team delete --team-id <id> --dry-run
upstash team delete --team-id <id>
upstash team members --team-id <id>
upstash team add-member --team-id <id> --member-email <email> --role <role>
upstash team remove-member --team-id <id> --member-email <email> --dry-run
upstash team remove-member --team-id <id> --member-email <email>
```

Member roles: `admin`, `dev`, `finance`.

## Vector commands

```bash
upstash vector list
upstash vector get --index-id <id>
upstash vector create --name <name> --region <region> --similarity-function <fn> --dimension-count <n>
upstash vector delete --index-id <id> --dry-run
upstash vector delete --index-id <id>
upstash vector rename --index-id <id> --name <new-name>
upstash vector reset-password --index-id <id>
upstash vector set-plan --index-id <id> --plan <plan>   # free, payg, fixed
upstash vector transfer --index-id <id> --target-account <id>
upstash vector stats
upstash vector index-stats --index-id <id>
upstash vector index-stats --index-id <id> --period <period>   # 1h, 3h, 12h, 1d, 3d, 7d, 30d
```

**Regions:** `eu-west-1`, `us-east-1`, `us-central1`  
**Similarity:** `COSINE`, `EUCLIDEAN`, `DOT_PRODUCT`  
**Index types:** `DENSE`, `SPARSE`, `HYBRID`

## Search commands

```bash
upstash search list
upstash search get --index-id <id>
upstash search create --name <name> --region <region> --type <type>
upstash search delete --index-id <id> --dry-run
upstash search delete --index-id <id>
upstash search rename --index-id <id> --name <new-name>
upstash search reset-password --index-id <id>
upstash search transfer --index-id <id> --target-account <id>
upstash search stats
upstash search index-stats --index-id <id>
upstash search index-stats --index-id <id> --period <period>
```

**Regions:** `eu-west-1`, `us-central1`  
**Plans:** `free`, `payg`, `fixed`

## QStash commands

```bash
upstash qstash list                                       # All instances; map region → id for other commands
upstash qstash get --qstash-id <id>
upstash qstash rotate-token --qstash-id <id>
upstash qstash set-plan --qstash-id <id> --plan <plan>        # paid, qstash_fixed_1m, qstash_fixed_10m, qstash_fixed_100m
upstash qstash stats --qstash-id <id>
upstash qstash stats --qstash-id <id> --period <period>       # 1h, 3h, 12h, 1d, 3d, 7d, 30d
upstash qstash ipv4
upstash qstash move-to-team --qstash-id <id> --target-team-id <id>
upstash qstash update-budget --qstash-id <id> --budget <dollars>   # 0 = no limit
upstash qstash enable-prodpack --qstash-id <id>
upstash qstash disable-prodpack --qstash-id <id>
```

## Examples

```bash
upstash redis list | jq '.[].database_id'
upstash vector list | jq '.[] | {id, name, region}'
upstash qstash list | jq '.[] | {id, region}'
upstash team members --team-id <id> | jq '.[].member_email'
```

Use `--dry-run` before `delete` or `remove-member`. Use `--hide-credentials` on `redis get` when you do not need the password.

## Contributing

From a clone: `npm install` and `npm run build`, then run `node dist/cli.js …` or `npm link` to try your build as `upstash`.

Issues and improvements: open a ticket or talk to us on [Discord](https://discord.com/invite/w9SenAtbme).
