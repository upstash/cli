import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRedisProgram, runCommand } from "../helpers/program.js";
import type { Database, Backup } from "../../src/types.js";

const TEST_NAME = `cli-test-${Date.now()}`;
let dbId: string | undefined;
let dbEndpoint: string | undefined;
let dbRestToken: string | undefined;

beforeAll(async () => {
  const p = await createRedisProgram();
  const db = await runCommand(p, [
    "redis", "create",
    "--name", TEST_NAME,
    "--region", "us-east-1",
  ]) as Database;

  expect(db.database_id).toBeDefined();
  dbId = db.database_id;
  dbEndpoint = db.endpoint;
  dbRestToken = db.rest_token;
});

afterAll(async () => {
  if (!dbId) return;
  const p = await createRedisProgram();
  await runCommand(p, ["redis", "delete", "--db-id", dbId]);
});

describe("redis list", () => {
  it("includes the created database", async () => {
    const p = await createRedisProgram();
    const dbs = await runCommand(p, ["redis", "list"]) as Database[];
    expect(Array.isArray(dbs)).toBe(true);
    expect(dbs.some((db) => db.database_id === dbId)).toBe(true);
  });
});

describe("redis get", () => {
  it("returns the database by id", async () => {
    const p = await createRedisProgram();
    const db = await runCommand(p, ["redis", "get", "--db-id", dbId!]) as Database;
    expect(db.database_id).toBe(dbId);
    expect(db.database_name).toBe(TEST_NAME);
  });

  it("omits password with --hide-credentials", async () => {
    const p = await createRedisProgram();
    const db = await runCommand(p, ["redis", "get", "--db-id", dbId!, "--hide-credentials"]) as Database;
    expect(db.password).toBeUndefined();
  });
});

describe("redis rename", () => {
  it("updates the database name", async () => {
    const newName = `${TEST_NAME}-renamed`;
    const p = await createRedisProgram();
    await runCommand(p, ["redis", "rename", "--db-id", dbId!, "--name", newName]);

    const p2 = await createRedisProgram();
    const db = await runCommand(p2, ["redis", "get", "--db-id", dbId!]) as Database;
    
    expect(db.database_name).toBe(newName);

    // rename back so subsequent tests aren't affected
    const p3 = await createRedisProgram();
    await runCommand(p3, ["redis", "rename", "--db-id", dbId!, "--name", TEST_NAME]);
  });
});

describe("redis stats", () => {
  it("returns a stats object", async () => {
    const p = await createRedisProgram();
    const stats = await runCommand(p, ["redis", "stats", "--db-id", dbId!]) as Record<string, unknown>;
    expect(stats).toBeDefined();
    expect(typeof stats).toBe("object");
  });
});

describe("redis eviction", () => {
  it("enables and disables eviction", async () => {
    const p1 = await createRedisProgram();
    const enabled = await runCommand(p1, ["redis", "enable-eviction", "--db-id", dbId!]) as Record<string, unknown>;
    expect(enabled).toBeDefined();

    const p2 = await createRedisProgram();
    const disabled = await runCommand(p2, ["redis", "disable-eviction", "--db-id", dbId!]) as Record<string, unknown>;
    expect(disabled).toBeDefined();
  });
});

describe("redis autoupgrade", () => {
  it("enables and disables autoupgrade", async () => {
    const p1 = await createRedisProgram();
    await runCommand(p1, ["redis", "enable-autoupgrade", "--db-id", dbId!]);

    const p2 = await createRedisProgram();
    await runCommand(p2, ["redis", "disable-autoupgrade", "--db-id", dbId!]);

    const p3 = await createRedisProgram();
    const db = await runCommand(p3, ["redis", "get", "--db-id", dbId!]) as Database;
    expect(db.auto_upgrade).toBe(false);
  });
});

describe("redis backup", () => {
  let backupId: string | undefined;

  it("creates a backup and appears in list", async () => {
    // wait for DB to be fully active before triggering a backup
    await new Promise((r) => setTimeout(r, 5000));

    const p = await createRedisProgram();
    await runCommand(p, [
      "redis", "backup", "create",
      "--db-id", dbId!,
      "--name", "test-backup",
    ]);

    await new Promise((r) => setTimeout(r, 10000));
    const p2 = await createRedisProgram();
    const backups = await runCommand(p2, ["redis", "backup", "list", "--db-id", dbId!]) as Backup[];

    expect(Array.isArray(backups)).toBe(true);
    expect(backups.length).toBeGreaterThan(0);
    backupId = backups[0]?.backup_id;
    expect(backupId).toBeDefined();
  });

  it("deletes the backup (dry-run)", async () => {
    if (!backupId) return;
    const p = await createRedisProgram();
    const result = await runCommand(p, [
      "redis", "backup", "delete",
      "--db-id", dbId!,
      "--backup-id", backupId,
      "--dry-run",
    ]) as Record<string, unknown>;
    expect(result["dry_run"]).toBe(true);
  });

  it("deletes the backup", async () => {
    if (!backupId) return;
    const p = await createRedisProgram();
    await runCommand(p, [
      "redis", "backup", "delete",
      "--db-id", dbId!,
      "--backup-id", backupId,
    ]);
  });
});

describe("redis delete dry-run", () => {
  it("returns dry_run: true without deleting", async () => {
    const p = await createRedisProgram();
    const result = await runCommand(p, ["redis", "delete", "--db-id", dbId!, "--dry-run"]) as Record<string, unknown>;
    expect(result["dry_run"]).toBe(true);
    expect(result["database_id"]).toBe(dbId);
  });
});

describe("redis exec", () => {
  it("executes SET and GET commands against the database", async () => {
    if (!dbEndpoint || !dbRestToken) {
      console.warn("Skipping exec tests: endpoint or rest_token not available");
      return;
    }

    const dbUrl = `https://${dbEndpoint}`;

    const p1 = await createRedisProgram();
    const setResult = await runCommand(p1, [
      "redis", "exec",
      "--db-url", dbUrl,
      "--db-token", dbRestToken,
      "SET", "cli-test-key", "hello",
    ]) as { result: unknown };
    expect(setResult.result).toBe("OK");

    const p2 = await createRedisProgram();
    const getResult = await runCommand(p2, [
      "redis", "exec",
      "--db-url", dbUrl,
      "--db-token", dbRestToken,
      "GET", "cli-test-key",
    ]) as { result: unknown };
    expect(getResult.result).toBe("hello");

    const p3 = await createRedisProgram();
    await runCommand(p3, [
      "redis", "exec",
      "--db-url", dbUrl,
      "--db-token", dbRestToken,
      "DEL", "cli-test-key",
    ]);
  });

  it("executes PING", async () => {
    if (!dbEndpoint || !dbRestToken) return;

    const p = await createRedisProgram();
    const result = await runCommand(p, [
      "redis", "exec",
      "--db-url", `https://${dbEndpoint}`,
      "--db-token", dbRestToken,
      "PING",
    ]) as { result: unknown };
    expect(result.result).toBe("PONG");
  });
});
