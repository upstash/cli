
# Upstash CLI — Agent Skill

The same instructions are packaged for VS Code Agent Skills at `.agents/skills/upstash-cli/SKILL.md`.

The Upstash CLI (`upstash`) manages Upstash services via the Upstash Developer API. Every command is non-interactive and always outputs JSON.

## Installation

```bash
npm i -g @upstash/cli
```

From a clone: `npm install`, `npm run build`, then `node dist/cli.js …` or `npm link`.

## Authentication

Three ways to supply credentials (precedence: flags > env vars > `.env` file):

**Environment variables:**
```bash
export UPSTASH_EMAIL=you@example.com
export UPSTASH_API_KEY=your_api_key
```

**`.env` file** — place a `.env` in the working directory and the CLI loads it automatically:
```bash
UPSTASH_EMAIL=you@example.com
UPSTASH_API_KEY=your_api_key
```

**Per-command flags:** `--email <email>` and `--api-key <key>` override everything else for that invocation.

**Custom `.env` path:** pass `--env-file <path>` as a global flag to load credentials from a specific file:
```bash
upstash --env-file ~/secrets/.env redis list
```

**Agents:** You can use a **read-only** Developer API key in `UPSTASH_API_KEY`. The Developer API then only returns what that key is allowed to see, and only the actions allowed for that key will succeed; anything else fails at the API.

## Global Flags

Every command accepts these flags:

| Flag | Description |
|------|-------------|
| `--email <email>` | Upstash email (overrides `UPSTASH_EMAIL`) |
| `--api-key <key>` | Upstash API key (overrides `UPSTASH_API_KEY`) |

**Resource IDs** — scoped commands use `--db-id`, `--index-id`, `--qstash-id`, or `--team-id` followed by the placeholder **`<id>`** (e.g. `--index-id <id>`), including in `--help` output.

| Flag | Products |
|------|----------|
| `--db-id <id>` | Redis |
| `--index-id <id>` | Vector, Search |
| `--qstash-id <id>` | QStash |
| `--team-id <id>` | Team (`delete`, `members`; also `add-member` / `remove-member`) |

## Output Format

All commands output JSON to stdout. Errors output `{ "error": "..." }` to stderr and exit with code 1.

### Success with data
```json
{ "database_id": "...", "database_name": "mydb", "state": "active", ... }
```

### Boolean operation success
```json
{ "success": true, "database_id": "..." }
```

### Delete success
```json
{ "deleted": true, "database_id": "..." }
```

### Error (exits with code 1)
```json
{ "error": "detailed error message" }
```

---

## Redis Commands

### Execute Commands

```bash
upstash redis exec --db-url <url> --db-token <token> --command "SET key value"
upstash redis exec --db-url <url> --db-token <token> --command "GET key"
upstash redis exec --db-url <url> --db-token <token> --command "HGETALL myhash"
```

`--db-url` and `--db-token` can be omitted if `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set (env vars or `.env` file). The values come from a prior `upstash redis get --db-id <id>` call (`endpoint` and `rest_token` fields). Returns `{ "result": ... }` on success or `{ "error": "..." }` on failure.

### Core CRUD

```bash
upstash redis list
upstash redis get --db-id <id>
upstash redis get --db-id <id> --hide-credentials   # Omit password from output
upstash redis create --name <name> --region <region>
upstash redis create --name <name> --region <region> --read-regions <r1> <r2>
upstash redis delete --db-id <id> --dry-run         # Preview before deleting
upstash redis delete --db-id <id>
upstash redis rename --db-id <id> --name <new-name>
upstash redis reset-password --db-id <id>
upstash redis stats --db-id <id>
```

### Available Redis Regions

**AWS:** `us-east-1`, `us-east-2`, `us-west-1`, `us-west-2`, `ca-central-1`, `eu-central-1`, `eu-west-1`, `eu-west-2`, `sa-east-1`, `ap-south-1`, `ap-northeast-1`, `ap-southeast-1`, `ap-southeast-2`, `af-south-1`

**GCP:** `us-central1`, `us-east4`, `europe-west1`, `asia-northeast1`

### Configuration

```bash
upstash redis enable-tls --db-id <id>
upstash redis enable-eviction --db-id <id>
upstash redis disable-eviction --db-id <id>
upstash redis enable-autoupgrade --db-id <id>
upstash redis disable-autoupgrade --db-id <id>
upstash redis change-plan --db-id <id> --plan <plan>       # Plans: free, payg, pro, paid
upstash redis update-budget --db-id <id> --budget <cents>  # Monthly budget in cents
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
upstash team list
upstash team create --name <name>
upstash team create --name <name> --copy-cc              # Copy credit card to team
upstash team delete --team-id <id> --dry-run
upstash team delete --team-id <id>
upstash team members --team-id <id>                 # List team members
upstash team add-member --team-id <id> --member-email <email> --role <role>
upstash team remove-member --team-id <id> --member-email <email> --dry-run
upstash team remove-member --team-id <id> --member-email <email>
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
upstash vector list
upstash vector get --index-id <id>
upstash vector create --name <name> --region <region> --similarity-function <fn> --dimension-count <n>
upstash vector create --name <name> --region us-east-1 --similarity-function COSINE --dimension-count 1536 --type payg
upstash vector create --name <name> --region us-east-1 --similarity-function COSINE --dimension-count 0 --index-type HYBRID --embedding-model BGE_M3 --sparse-embedding-model BM25
upstash vector delete --index-id <id> --dry-run
upstash vector delete --index-id <id>
upstash vector rename --index-id <id> --name <new-name>
upstash vector reset-password --index-id <id>
upstash vector set-plan --index-id <id> --plan <plan>         # Plans: free, payg, fixed
upstash vector transfer --index-id <id> --target-account <id>
upstash vector stats                                     # Aggregate stats across all indexes
upstash vector index-stats --index-id <id>
upstash vector index-stats --index-id <id> --period <period>  # Periods: 1h, 3h, 12h, 1d, 3d, 7d, 30d
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
upstash search list
upstash search get --index-id <id>
upstash search create --name <name> --region <region> --type <type>
upstash search delete --index-id <id> --dry-run
upstash search delete --index-id <id>
upstash search rename --index-id <id> --name <new-name>
upstash search reset-password --index-id <id>
upstash search transfer --index-id <id> --target-account <id>
upstash search stats                                      # Aggregate stats across all indexes
upstash search index-stats --index-id <id>
upstash search index-stats --index-id <id> --period <period>   # Periods: 1h, 3h, 12h, 1d, 3d, 7d, 30d
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
upstash qstash list                                       # All instances; map `region` → `id` for other commands
upstash qstash get --qstash-id <id>
upstash qstash rotate-token --qstash-id <id>
upstash qstash set-plan --qstash-id <id> --plan <plan>        # Plans: paid, qstash_fixed_1m, qstash_fixed_10m, qstash_fixed_100m
upstash qstash stats --qstash-id <id>
upstash qstash stats --qstash-id <id> --period <period>       # Periods: 1h, 3h, 12h, 1d, 3d, 7d, 30d
upstash qstash ipv4                                      # CIDR blocks for firewall allowlisting
upstash qstash move-to-team --qstash-id <id> --target-team-id <id>
upstash qstash update-budget --qstash-id <id> --budget <dollars>  # 0 = no limit
upstash qstash enable-prodpack --qstash-id <id>
upstash qstash disable-prodpack --qstash-id <id>
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

- All output is JSON — pipe through `jq` for field extraction.
- Exit code `0` = success, `1` = error.
- Use `--dry-run` before any `delete` or `remove-member` command to confirm the target.
- Use `--hide-credentials` on `redis get` when the password is not needed.
- Run `upstash qstash list` first to discover which `id` maps to which `region`, then use those IDs for all other qstash commands.
- Field extraction examples:
  ```bash
  upstash redis list | jq '.[].database_id'
  upstash vector list | jq '.[] | {id, name, region}'
  upstash qstash list | jq '.[] | {id, region}'
  upstash team members --team-id <id> | jq '.[].member_email'
  ```
