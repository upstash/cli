import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createVectorProgram, runCommand } from "../helpers/program.js";
import type { VectorIndex } from "../../src/types.js";

const TEST_NAME = `cli-test-${Date.now()}`;
let indexId: string | undefined;

beforeAll(async () => {
  const p = await createVectorProgram();
  const idx = await runCommand(p, [
    "vector", "create",
    "--name", TEST_NAME,
    "--region", "us-east-1",
    "--similarity-function", "COSINE",
    "--dimension-count", "1536",
  ]) as VectorIndex;

  expect(idx.id).toBeDefined();
  indexId = idx.id;
});

afterAll(async () => {
  if (!indexId) return;
  const p = await createVectorProgram();
  await runCommand(p, ["vector", "delete", "--index-id", indexId]);
});

describe("vector list", () => {
  it("includes the created index", async () => {
    const p = await createVectorProgram();
    const indexes = await runCommand(p, ["vector", "list"]) as VectorIndex[];
    expect(Array.isArray(indexes)).toBe(true);
    expect(indexes.some((idx) => idx.id === indexId)).toBe(true);
  });
});

describe("vector get", () => {
  it("returns the index by id", async () => {
    const p = await createVectorProgram();
    const idx = await runCommand(p, ["vector", "get", "--index-id", indexId!]) as VectorIndex;
    expect(idx.id).toBe(indexId);
    expect(idx.name).toBe(TEST_NAME);
    expect(idx.similarity_function).toBe("COSINE");
    expect(idx.dimension_count).toBe(1536);
  });
});

describe("vector rename", () => {
  it("updates the index name", async () => {
    const newName = `${TEST_NAME}-renamed`;
    const p = await createVectorProgram();
    await runCommand(p, ["vector", "rename", "--index-id", indexId!, "--name", newName]);

    const p2 = await createVectorProgram();
    const idx = await runCommand(p2, ["vector", "get", "--index-id", indexId!]) as VectorIndex;
    expect(idx.name).toBe(newName);

    const p3 = await createVectorProgram();
    await runCommand(p3, ["vector", "rename", "--index-id", indexId!, "--name", TEST_NAME]);
  });
});

describe("vector index-stats", () => {
  it("returns stats for the index", async () => {
    const p = await createVectorProgram();
    const stats = await runCommand(p, ["vector", "index-stats", "--index-id", indexId!]) as Record<string, unknown>;
    expect(stats).toBeDefined();
    expect(typeof stats).toBe("object");
  });
});

describe("vector delete dry-run", () => {
  it("returns dry_run: true without deleting", async () => {
    const p = await createVectorProgram();
    const result = await runCommand(p, ["vector", "delete", "--index-id", indexId!, "--dry-run"]) as Record<string, unknown>;
    expect(result["dry_run"]).toBe(true);
    expect(result["index_id"]).toBe(indexId);
  });
});
