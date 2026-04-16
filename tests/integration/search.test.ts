import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createSearchProgram, runCommand } from "../helpers/program.js";
import type { SearchIndex } from "../../src/types.js";

const TEST_NAME = `cli-test-${Date.now()}`;
let indexId: string | undefined;

beforeAll(async () => {
  const p = await createSearchProgram();
  const idx = await runCommand(p, [
    "search", "create",
    "--name", TEST_NAME,
    "--region", "eu-west-1",
    "--type", "payg",
  ]) as SearchIndex;

  expect(idx.id).toBeDefined();
  indexId = idx.id;
});

afterAll(async () => {
  if (!indexId) return;
  const p = await createSearchProgram();
  await runCommand(p, ["search", "delete", "--index-id", indexId]);
});

describe("search list", () => {
  it("includes the created index", async () => {
    const p = await createSearchProgram();
    const indexes = await runCommand(p, ["search", "list"]) as SearchIndex[];
    expect(Array.isArray(indexes)).toBe(true);
    expect(indexes.some((idx) => idx.id === indexId)).toBe(true);
  });
});

describe("search get", () => {
  it("returns the index by id", async () => {
    const p = await createSearchProgram();
    const idx = await runCommand(p, ["search", "get", "--index-id", indexId!]) as SearchIndex;
    expect(idx.id).toBe(indexId);
    expect(idx.name).toBe(TEST_NAME);
  });
});

describe("search rename", () => {
  it("updates the index name", async () => {
    const newName = `${TEST_NAME}-renamed`;
    const p = await createSearchProgram();
    await runCommand(p, ["search", "rename", "--index-id", indexId!, "--name", newName]);

    const p2 = await createSearchProgram();
    const idx = await runCommand(p2, ["search", "get", "--index-id", indexId!]) as SearchIndex;
    expect(idx.name).toBe(newName);

    const p3 = await createSearchProgram();
    await runCommand(p3, ["search", "rename", "--index-id", indexId!, "--name", TEST_NAME]);
  });
});

describe("search index-stats", () => {
  it("returns stats for the index", async () => {
    const p = await createSearchProgram();
    const stats = await runCommand(p, ["search", "index-stats", "--index-id", indexId!]) as Record<string, unknown>;
    expect(stats).toBeDefined();
    expect(typeof stats).toBe("object");
  });
});

describe("search delete dry-run", () => {
  it("returns dry_run: true without deleting", async () => {
    const p = await createSearchProgram();
    const result = await runCommand(p, ["search", "delete", "--index-id", indexId!, "--dry-run"]) as Record<string, unknown>;
    expect(result["dry_run"]).toBe(true);
    expect(result["index_id"]).toBe(indexId);
  });
});
