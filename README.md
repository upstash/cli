# Upstash CLI

Manage Upstash services from the terminal or automation via the [Upstash Developer API](https://docs.upstash.com/redis/howto/developerapi). Commands are non-interactive and support `--json` for structured output.

![](./img/banner.svg)

![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/upstash/cli)
[![Downloads/week](https://img.shields.io/npm/dw/lstr.svg)](https://npmjs.org/package/@upstash/cli)

**Agent reference:** the same command catalog lives in [`CLAUDE.md`](./CLAUDE.md) and [`skill.md`](./skill.md).

## Installation

### npm (global)

```bash
npm i -g @upstash/cli
```

The binary is `upstash` on your `PATH`.

### From this repository

```bash
npm install
npm run build
npm link
```

Compiled binaries for Windows, Linux, and macOS (Intel and Apple Silicon) are on the [releases page](https://github.com/upstash/cli/releases/latest).

## Authentication

Recommended for CI and agents:

```bash
export UPSTASH_EMAIL=you@example.com
export UPSTASH_API_KEY=your_api_key
```

Or save credentials to `~/.upstash.json`:

```bash
upstash auth login --email you@example.com --api-key your_api_key
```

See [how to get an API key](https://docs.upstash.com/redis/howto/developerapi#api-development).

## Global flags

These flags are accepted on commands that call the API:

| Flag | Description |
|------|-------------|
| `--email <email>` | Upstash email (overrides env / config file) |
| `--api-key <key>` | Upstash API key (overrides env / config file) |
| `--json` | Print structured JSON instead of human-readable text |

## Top-level commands

```text
upstash auth    # Credentials
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

## Output shapes (`--json`)

- **Resource payload:** e.g. `{ "database_id": "...", "state": "active", ... }`
- **Boolean success:** `{ "success": true, ... }`
- **Delete:** `{ "deleted": true, ... }`
- **Error (exit code 1):** `{ "error": "message" }`

## Auth commands

```bash
upstash auth login --email <email> --api-key <key> --json
upstash auth logout --json
upstash auth whoami --json
```

## Redis commands

### Core

```bash
upstash redis list --json
upstash redis get <database-id> --json
upstash redis get <database-id> --hide-credentials --json
upstash redis create --name <name> --region <region> --json
upstash redis create --name <name> --region <region> --read-regions <r1> <r2> --json
upstash redis delete <database-id> --dry-run --json
upstash redis delete <database-id> --json
upstash redis rename <database-id> --name <new-name> --json
upstash redis reset-password <database-id> --json
upstash redis stats <database-id> --json
```

**Regions — AWS:** `us-east-1`, `us-east-2`, `us-west-1`, `us-west-2`, `ca-central-1`, `eu-central-1`, `eu-west-1`, `eu-west-2`, `sa-east-1`, `ap-south-1`, `ap-northeast-1`, `ap-southeast-1`, `ap-southeast-2`, `af-south-1`  
**Regions — GCP:** `us-central1`, `us-east4`, `europe-west1`, `asia-northeast1`

### Configuration

```bash
upstash redis enable-tls <database-id> --json
upstash redis enable-eviction <database-id> --json
upstash redis disable-eviction <database-id> --json
upstash redis enable-autoupgrade <database-id> --json
upstash redis disable-autoupgrade <database-id> --json
upstash redis change-plan <database-id> --plan <plan> --json   # free, payg, pro, paid
upstash redis update-budget <database-id> --budget <cents> --json
upstash redis update-regions <database-id> --read-regions <r1> <r2> --json
upstash redis move-to-team <database-id> --team-id <team-id> --json
```

### Backups

```bash
upstash redis backup list <database-id> --json
upstash redis backup create <database-id> --name <name> --json
upstash redis backup delete <database-id> <backup-id> --dry-run --json
upstash redis backup delete <database-id> <backup-id> --json
upstash redis backup restore <database-id> --backup-id <backup-id> --json
upstash redis backup enable-daily <database-id> --json
upstash redis backup disable-daily <database-id> --json
```

## Team commands

```bash
upstash team list --json
upstash team create --name <name> --json
upstash team create --name <name> --copy-cc --json
upstash team delete <team-id> --dry-run --json
upstash team delete <team-id> --json
upstash team members <team-id> --json
upstash team add-member --team-id <id> --member-email <email> --role <role> --json
upstash team remove-member --team-id <id> --member-email <email> --dry-run --json
upstash team remove-member --team-id <id> --member-email <email> --json
```

Member roles: `admin`, `dev`, `finance`.

## Vector commands

```bash
upstash vector list --json
upstash vector get <index-id> --json
upstash vector create --name <name> --region <region> --similarity-function <fn> --dimension-count <n> --json
upstash vector delete <index-id> --dry-run --json
upstash vector delete <index-id> --json
upstash vector rename <index-id> --name <new-name> --json
upstash vector reset-password <index-id> --json
upstash vector set-plan <index-id> --plan <plan> --json   # free, payg, fixed
upstash vector transfer <index-id> --target-account <team-id> --json
upstash vector stats --json
upstash vector index-stats <index-id> --json
upstash vector index-stats <index-id> --period <period> --json   # 1h, 3h, 12h, 1d, 3d, 7d, 30d
```

**Regions:** `eu-west-1`, `us-east-1`, `us-central1`  
**Similarity:** `COSINE`, `EUCLIDEAN`, `DOT_PRODUCT`  
**Index types:** `DENSE`, `SPARSE`, `HYBRID`

## Search commands

```bash
upstash search list --json
upstash search get <index-id> --json
upstash search create --name <name> --region <region> --type <type> --json
upstash search delete <index-id> --dry-run --json
upstash search delete <index-id> --json
upstash search rename <index-id> --name <new-name> --json
upstash search reset-password <index-id> --json
upstash search transfer <index-id> --target-account <team-id> --json
upstash search stats --json
upstash search index-stats <index-id> --json
upstash search index-stats <index-id> --period <period> --json
```

**Regions:** `eu-west-1`, `us-central1`  
**Plans:** `free`, `payg`, `fixed`

## QStash commands

```bash
upstash qstash list --json                                       # All instances; map region → id for other commands
upstash qstash get <qstash-id> --json
upstash qstash rotate-token <qstash-id> --json
upstash qstash set-plan <qstash-id> --plan <plan> --json        # paid, qstash_fixed_1m, qstash_fixed_10m, qstash_fixed_100m
upstash qstash stats <qstash-id> --json
upstash qstash stats <qstash-id> --period <period> --json       # 1h, 3h, 12h, 1d, 3d, 7d, 30d
upstash qstash ipv4 --json
upstash qstash move-to-team --qstash-id <id> --target-team-id <id> --json
upstash qstash update-budget <qstash-id> --budget <dollars> --json   # 0 = no limit
upstash qstash enable-prodpack <qstash-id> --json
upstash qstash disable-prodpack <qstash-id> --json
```

## Examples

```bash
upstash redis list --json | jq '.[].database_id'
upstash vector list --json | jq '.[] | {id, name, region}'
upstash qstash list --json | jq '.[] | {id, region}'
upstash team members <team-id> --json | jq '.[].member_email'
```

Use `--dry-run` before `delete` or `remove-member`. Use `--hide-credentials` on `redis get` when you do not need the password.

## Contributing

Issues and improvements: open a ticket or talk to us on [Discord](https://discord.com/invite/w9SenAtbme).
