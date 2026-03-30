# Upstash CLI — Agent Skill

The Upstash CLI (`upstash`) manages Upstash services via the Upstash Developer API. Every command is non-interactive and supports `--json` for structured output.

## Installation

```bash
# From the repo root
npm install
npm run build
npm link
```

## Authentication

Set environment variables (recommended for agents):

```bash
export UPSTASH_EMAIL=you@example.com
export UPSTASH_API_KEY=your_api_key
```

Or save to `~/.upstash.json`:

```bash
upstash auth login --email you@example.com --api-key your_api_key
```

## Global Flags

Every command accepts these flags:

| Flag | Description |
|------|-------------|
| `--email <email>` | Upstash email (overrides env/config) |
| `--api-key <key>` | Upstash API key (overrides env/config) |
| `--json` | Output structured JSON instead of human-readable text |

## Output Formats

### Success with data (`--json`)
```json
{ "database_id": "...", "database_name": "mydb", "state": "active", ... }
```

### Boolean operation success (`--json`)
```json
{ "success": true, "database_id": "..." }
```

### Delete success (`--json`)
```json
{ "deleted": true, "database_id": "..." }
```

### Error (`--json`, exits with code 1)
```json
{ "error": "detailed error message" }
```

---

## Auth Commands

```bash
upstash auth login --email <email> --api-key <key> --json   # Save credentials
upstash auth logout --json                                   # Clear credentials
upstash auth whoami --json                                   # Show current email
```

---

## Redis Commands

### Core CRUD

```bash
upstash redis list --json
upstash redis get <database-id> --json
upstash redis get <database-id> --hide-credentials --json   # Omit password from output
upstash redis create --name <name> --region <region> --json
upstash redis create --name <name> --region <region> --read-regions <r1> <r2> --json
upstash redis delete <database-id> --dry-run --json         # Preview before deleting
upstash redis delete <database-id> --json
upstash redis rename <database-id> --name <new-name> --json
upstash redis reset-password <database-id> --json
upstash redis stats <database-id> --json
```

### Available Redis Regions

**AWS:** `us-east-1`, `us-east-2`, `us-west-1`, `us-west-2`, `ca-central-1`, `eu-central-1`, `eu-west-1`, `eu-west-2`, `sa-east-1`, `ap-south-1`, `ap-northeast-1`, `ap-southeast-1`, `ap-southeast-2`, `af-south-1`

**GCP:** `us-central1`, `us-east4`, `europe-west1`, `asia-northeast1`

### Configuration

```bash
upstash redis enable-tls <database-id> --json
upstash redis enable-eviction <database-id> --json
upstash redis disable-eviction <database-id> --json
upstash redis enable-autoupgrade <database-id> --json
upstash redis disable-autoupgrade <database-id> --json
upstash redis change-plan <database-id> --plan <plan> --json       # Plans: free, payg, pro, paid
upstash redis update-budget <database-id> --budget <cents> --json  # Monthly budget in cents
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

### Redis Database Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `database_id` | string | Unique identifier (UUID) |
| `database_name` | string | Display name |
| `endpoint` | string | Redis connection hostname |
| `port` | number | Redis port |
| `password` | string | Redis password (omitted with `--hide-credentials`) |
| `state` | string | `active`, `suspended`, or `passive` |
| `tls` | boolean | TLS enabled |
| `type` | string | `free`, `payg`, `pro`, or `paid` |
| `primary_region` | string | Primary region |
| `read_regions` | string[] | Read replica regions |
| `eviction` | boolean | Key eviction enabled |
| `auto_upgrade` | boolean | Auto version upgrade enabled |
| `daily_backup_enabled` | boolean | Daily backups enabled |
| `budget` | number | Monthly spend cap in cents |
| `creation_time` | number | Unix timestamp |

---

## Team Commands

```bash
upstash team list --json
upstash team create --name <name> --json
upstash team create --name <name> --copy-cc --json              # Copy credit card to team
upstash team delete <team-id> --dry-run --json
upstash team delete <team-id> --json
upstash team members <team-id> --json                           # List team members
upstash team add-member --team-id <id> --member-email <email> --role <role> --json
upstash team remove-member --team-id <id> --member-email <email> --dry-run --json
upstash team remove-member --team-id <id> --member-email <email> --json
```

Member roles: `admin`, `dev`, `finance`

### Team Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `team_id` | string | Unique team identifier |
| `team_name` | string | Team display name |
| `copy_cc` | boolean | Credit card copied to team |

### TeamMember Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `team_id` | string | Team identifier |
| `member_email` | string | Member email address |
| `member_role` | string | `owner`, `admin`, `dev`, or `finance` |

---

## Vector Commands

```bash
upstash vector list --json
upstash vector get <index-id> --json
upstash vector create --name <name> --region <region> --similarity-function <fn> --dimension-count <n> --json
upstash vector create --name <name> --region us-east-1 --similarity-function COSINE --dimension-count 1536 --type payg --json
upstash vector create --name <name> --region us-east-1 --similarity-function COSINE --dimension-count 0 --index-type HYBRID --embedding-model BGE_M3 --sparse-embedding-model BM25 --json
upstash vector delete <index-id> --dry-run --json
upstash vector delete <index-id> --json
upstash vector rename <index-id> --name <new-name> --json
upstash vector reset-password <index-id> --json
upstash vector set-plan <index-id> --plan <plan> --json         # Plans: free, payg, fixed
upstash vector transfer <index-id> --target-account <team-id> --json
upstash vector stats --json                                     # Aggregate stats across all indexes
upstash vector index-stats <index-id> --json
upstash vector index-stats <index-id> --period <period> --json  # Periods: 1h, 3h, 12h, 1d, 3d, 7d, 30d
```

### Available Vector Regions

`eu-west-1`, `us-east-1`, `us-central1`

### Similarity Functions

`COSINE`, `EUCLIDEAN`, `DOT_PRODUCT`

### Index Types

`DENSE`, `SPARSE`, `HYBRID`

### Embedding Models

`BGE_SMALL_EN_V1_5`, `BGE_BASE_EN_V1_5`, `BGE_LARGE_EN_V1_5`, `BGE_M3`

### Sparse Embedding Models

`BM25`, `BGE_M3`

### VectorIndex Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique index identifier |
| `name` | string | Index name |
| `region` | string | Deployment region |
| `similarity_function` | string | Distance metric |
| `dimension_count` | number | Dimensions per vector |
| `index_type` | string | `DENSE`, `SPARSE`, or `HYBRID` |
| `embedding_model` | string | Dense embedding model (if set) |
| `sparse_embedding_model` | string | Sparse embedding model (if set) |
| `endpoint` | string | REST endpoint hostname |
| `token` | string | Read-write auth token |
| `read_only_token` | string | Read-only auth token |
| `type` | string | `free`, `payg`, or `fixed` |
| `max_vector_count` | number | Vector capacity |
| `creation_time` | number | Unix timestamp |

---

## Search Commands

```bash
upstash search list --json
upstash search get <index-id> --json
upstash search create --name <name> --region <region> --type <type> --json
upstash search delete <index-id> --dry-run --json
upstash search delete <index-id> --json
upstash search rename <index-id> --name <new-name> --json
upstash search reset-password <index-id> --json
upstash search transfer <index-id> --target-account <team-id> --json
upstash search stats --json                                      # Aggregate stats across all indexes
upstash search index-stats <index-id> --json
upstash search index-stats <index-id> --period <period> --json   # Periods: 1h, 3h, 12h, 1d, 3d, 7d, 30d
```

### Available Search Regions

`eu-west-1`, `us-central1`

### Search Plans

`free`, `payg`, `fixed`

### SearchIndex Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique index identifier |
| `name` | string | Index name |
| `region` | string | Deployment region |
| `type` | string | `free`, `payg`, or `fixed` |
| `endpoint` | string | REST endpoint hostname |
| `token` | string | Read-write auth token |
| `read_only_token` | string | Read-only auth token |
| `input_enrichment_enabled` | boolean | Input enrichment enabled |
| `creation_time` | number | Unix timestamp |

---

## QStash Commands

```bash
upstash qstash list --json                                       # All instances; map `region` → `id` for other commands
upstash qstash get <qstash-id> --json
upstash qstash rotate-token <qstash-id> --json
upstash qstash set-plan <qstash-id> --plan <plan> --json        # Plans: paid, qstash_fixed_1m, qstash_fixed_10m, qstash_fixed_100m
upstash qstash stats <qstash-id> --json
upstash qstash stats <qstash-id> --period <period> --json       # Periods: 1h, 3h, 12h, 1d, 3d, 7d, 30d
upstash qstash ipv4 --json                                      # CIDR blocks for firewall allowlisting
upstash qstash move-to-team --qstash-id <id> --target-team-id <id> --json
upstash qstash update-budget <qstash-id> --budget <dollars> --json  # 0 = no limit
upstash qstash enable-prodpack <qstash-id> --json
upstash qstash disable-prodpack <qstash-id> --json
```

### QStashUser Object Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | QStash instance identifier |
| `customer_id` | string | Owner email or team ID |
| `token` | string | Auth token for QStash API |
| `state` | string | `active` or `passive` |
| `type` | string | `free` or `paid` |
| `reserved_type` | string | Reserved plan: `paid`, `qstash_fixed_1m`, `qstash_fixed_10m`, `qstash_fixed_100m` |
| `region` | string | `eu-central-1` or `us-east-1` |
| `budget` | number | Monthly spend cap in dollars (0 = no limit) |
| `prod_pack_enabled` | boolean | Production pack active |
| `max_requests_per_day` | number | Daily request soft limit |
| `max_requests_per_second` | number | Rate limit |
| `max_topics` | number | Max topics |
| `max_schedules` | number | Max schedules |
| `max_queues` | number | Max queues |
| `timeout` | number | Request timeout in seconds |
| `creation_time` | number | Unix timestamp |

---

## Tips for Agents

- Always use `--json` for reliable output parsing.
- Exit code `0` = success, `1` = error.
- Use `--dry-run` before any `delete` or `remove-member` command to confirm the target.
- Use `--hide-credentials` on `redis get` when the password is not needed.
- Pipe `--json` output through `jq` for field extraction:
  ```bash
  upstash redis list --json | jq '.[].database_id'
  upstash vector list --json | jq '.[] | {id, name, region}'
  upstash qstash list --json | jq '.[] | {id, region}'
  upstash team members <team-id> --json | jq '.[].member_email'
  ```
