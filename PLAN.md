# DX-2969 — Add Upstash Blob to `@upstash/cli`

Linear: https://linear.app/upstash/issue/DX-2969/cli-blob

## Objective

Add a small, agent-friendly Blob surface to the existing CLI. The CLI manages Blob buckets through the Upstash Developer API and provides one bridge from a bucket token to temporary, bucket-scoped S3 credentials. It does not reimplement S3 object operations: agents should use AWS CLI, rclone, or an S3 SDK once credentials are returned.

## Product and API facts

The control-plane source of truth is `upstash/upstash-cloud`; the current console implementation is in `upstash/upstash-console-v2`; credential behavior is defined by `upstash/blob-store` and `upstash/blob-js`.

Control-plane routes use the CLI's existing Developer API Basic authentication:

- `POST /v2/blob/bucket` — create a bucket
- `GET /v2/blob/bucket` — list buckets; list responses do not contain tokens
- `GET /v2/blob/bucket/:id` — get a bucket; may contain `token` and `token_next`
- `DELETE /v2/blob/bucket/:id` — delete an empty bucket

Create accepts:

```json
{
  "name": "bucket-name",
  "visibility": "private | public",
  "cors": ["https://example.com"]
}
```

`visibility` and `cors` are optional. The backend defaults visibility to `private`. Do not invent regions or plans: Blob buckets currently expose neither.

Temporary S3 credentials come from:

```text
POST https://blob.upstash.io/v1/credentials
Authorization: Bearer <bucket token>
```

The successful response is:

```json
{
  "accessKeyId": "...",
  "secretAccessKey": "...",
  "sessionToken": "...",
  "endpoint": "https://<account>.r2.cloudflarestorage.com",
  "bucket": "<bucket-id>",
  "region": "auto",
  "expiresAt": 1234567890
}
```

Credentials are temporary, bucket-scoped, and may have less than ten minutes remaining. `expiresAt` is authoritative.

## Command surface

Register a new top-level `blob` command described as `Manage Blob buckets`.

### `upstash blob create`

Options:

- required `--name <name>`
- optional `--visibility <visibility>`; accepted values are `private` and `public`; default to `private`
- optional variadic `--cors <origins...>`

Send only the documented fields. Print the returned bucket as JSON, including the initial tokens returned by create.

### `upstash blob list`

Call the list endpoint and print the returned array as JSON. Do not synthesize or request credentials.

### `upstash blob get`

Options:

- required `--bucket-id <id>`
- optional `--hide-credentials`

Call the get endpoint. By default, preserve `token` and `token_next`, matching the existing Redis `get` behavior. With `--hide-credentials`, remove both fields from a copied response before printing; do not mutate shared data and do not rely on an unsupported backend query parameter.

### `upstash blob delete`

Options:

- required `--bucket-id <id>`
- optional `--dry-run`

Dry-run must not resolve authentication or make a request. It prints:

```json
{ "action": "delete", "bucket_id": "...", "dry_run": true }
```

A real delete calls the API and prints:

```json
{ "deleted": true, "bucket_id": "..." }
```

Do not add recursive object deletion. The Developer API intentionally refuses deletion of a non-empty bucket.

### `upstash blob credentials`

Options:

- optional `--bucket-id <id>`

Token resolution:

1. When `--bucket-id` is present, resolve normal Developer API auth, fetch that bucket with `GET /v2/blob/bucket/:id`, and use its current `token`. This explicit mode wins even when `UPSTASH_BLOB_TOKEN` is set.
2. Without `--bucket-id`, read `UPSTASH_BLOB_TOKEN`.
3. If neither source supplies a non-empty token, fail with a clear error explaining both supported forms.
4. Do not add `--token`; command-line secrets leak into shell history and process listings.

Exchange the token at the Blob credential endpoint and print the successful response unchanged as JSON. Do not print the long-lived bucket token, cache credentials, write them to config, or add an env/shell output format.

Credential request behavior:

- Send `POST` with a Bearer authorization header and no body.
- Treat `401` as a rejected bucket token.
- Retry `429` and `503` up to three retries, honoring a positive numeric `Retry-After`; use 2 seconds when absent/invalid and cap a single wait at 10 seconds.
- After retries, surface the response error through the CLI's normal JSON error handling.
- Validate the success payload before printing. Required fields are non-empty strings except `expiresAt`, which must be a finite number.
- Parse `endpoint` as a URL and require HTTPS plus a hostname ending in `.r2.cloudflarestorage.com`. Reject an unexpected endpoint so downstream agents are not instructed to send data or credentials to an arbitrary host.

Keep this implementation dependency-free. Use the platform `fetch`; do not add `@upstash/blob`, an AWS SDK, or a signing package.

## Types

Extend `src/types.ts` with narrowly scoped Blob types:

- `BLOB_VISIBILITIES` and `BlobVisibility`
- `BlobBucketEvent`
- `BlobBucket`
- `BlobS3Credentials`

`BlobBucket` should model the current external response, including:

- `customer_id`, `id`, `name`, `hash_for_domain`
- `visibility`, `endpoint`, `pw_version`, `creation_time`
- optional `cors`, `created_by`, `events`, `token`, `token_next`

Do not include coordinator-only encrypted passwords or internal provisioning fields.

## File layout

Follow the existing one-command-per-file structure:

```text
src/commands/blob/
  index.ts
  create.ts
  list.ts
  get.ts
  delete.ts
  credentials.ts
```

Register `registerBlob(program)` in `src/cli.ts` beside the other product registrations. A small credential-response parser/retry helper may remain in `credentials.ts` unless extracting it clearly improves testing; avoid broad refactoring of `src/client.ts` just for one Bearer-authenticated endpoint.

## Error and output conventions

- Successful account commands emit pretty JSON via `printJSON`.
- Errors flow to the existing top-level `handleError`, producing `{ "error": "..." }` on stderr and exit code 1.
- Do not log Authorization headers, bucket tokens, or temporary secrets.
- Keep Commander descriptions precise enough for an agent to discover the workflow from `--help`.
- The credentials help text should state that the result is temporary S3 credentials and that `expiresAt` is the expiry.

## Tests

### Unit tests

Add a Blob program factory to `tests/helpers/program.ts`.

Add focused tests with mocked `global.fetch` covering:

1. Command registration and expected method/path/body for create, list, get, and delete.
2. Create defaults to private and passes CORS origins correctly.
3. `get --hide-credentials` removes both token fields while normal get preserves them.
4. Delete dry-run makes no HTTP request and produces the established preview shape.
5. Credentials by bucket id performs the Developer API GET first, then the Bearer POST using the fetched current token.
6. Credentials without bucket id uses `UPSTASH_BLOB_TOKEN` and does not attempt Developer API auth.
7. Explicit bucket id wins over an ambient `UPSTASH_BLOB_TOKEN`.
8. Missing token source fails clearly.
9. Credential success is printed unchanged.
10. Invalid/missing credential fields and a non-R2 or non-HTTPS endpoint are rejected.
11. `401` is reported as rejected authentication.
12. `429`/`503` retry behavior, fallback delay, retry limit, and eventual success/failure. Use fake timers or inject sleep so tests do not actually wait.

Restore environment variables, fetch, timers, console methods, and any other globals after each test so the existing serial suite remains isolated.

### Integration coverage

If the existing credentials can access Blob, add an opt-in integration lifecycle test guarded by `RUN_BLOB_INTEGRATION=1`:

- create a uniquely named private empty bucket
- verify list and get
- fetch temporary S3 credentials and validate bucket/endpoint/expiry
- delete the bucket in `finally`

Blob provisioning is asynchronous. Poll credential readiness and cleanup with a bounded timeout rather than assuming immediate readiness. Never upload an object in this test. Keep it opt-in so ordinary unit runs do not consume Blob quota or become flaky on the provisioning cron.

## README

Add concise examples to the existing Quick examples section:

```bash
upstash blob create --name my-bucket --visibility private
upstash blob list
upstash blob credentials --bucket-id $BUCKET_ID
```

Explain in one sentence that `credentials` returns temporary S3 credentials for use with AWS CLI, rclone, or an S3 SDK. Do not document object-operation commands because none are being added.

## Verification

Run from the worktree:

```bash
npm run build
npm run typecheck
npm test
node dist/cli.js blob --help
node dist/cli.js blob credentials --help
```

If Blob integration credentials and permission are available:

```bash
RUN_BLOB_INTEGRATION=1 npm test -- tests/integration/blob.test.ts
```

Inspect the final diff for accidental secrets and confirm no generated `dist` output is included unless it was already intentionally tracked by this repository.

## Non-goals

- No object list/get/put/delete/copy commands.
- No SigV4 implementation.
- No AWS SDK or `@upstash/blob` dependency.
- No persistent storage of bucket tokens or temporary S3 credentials.
- No advanced bucket operations such as rename, token rotation, visibility updates, CORS updates, usage stats, or transfer in this first pass.
- No changes to login/config precedence.

## Acceptance criteria

- `upstash --help` exposes the Blob group.
- Basic bucket create/list/get/delete works through the Developer API with existing auth.
- `credentials --bucket-id` turns account access into a validated temporary S3 credential bundle.
- `credentials` also works from `UPSTASH_BLOB_TOKEN` without Developer API auth.
- Destructive behavior retains dry-run support and never recursively deletes objects.
- Credentials and tokens are never persisted or logged.
- Build, typecheck, and unit tests pass with no new runtime dependency.
