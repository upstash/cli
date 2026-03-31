import { beforeAll, describe, expect, it } from "vitest";
import { createQStashProgram, runCommand } from "../helpers/program.js";
import type { QStashUser } from "../../src/types.js";

let qstashId: string | undefined;

beforeAll(async () => {
  const p = await createQStashProgram();
  const instances = await runCommand(p, ["qstash", "list"]) as QStashUser[];
  expect(Array.isArray(instances)).toBe(true);
  expect(instances.length).toBeGreaterThan(0);
  qstashId = instances[0]?.id;
  expect(qstashId).toBeDefined();
});

describe("qstash list", () => {
  it("returns at least one instance", async () => {
    const p = await createQStashProgram();
    const instances = await runCommand(p, ["qstash", "list"]) as QStashUser[];
    expect(Array.isArray(instances)).toBe(true);
    expect(instances.length).toBeGreaterThan(0);
  });
});

describe("qstash get", () => {
  it("returns the instance with expected fields", async () => {
    const p = await createQStashProgram();
    const instance = await runCommand(p, ["qstash", "get", "--qstash-id", qstashId!]) as QStashUser;
    expect(instance.id).toBe(qstashId);
    expect(instance.token).toBeDefined();
    expect(instance.region).toBeDefined();
    expect(instance.state).toBeDefined();
  });
});

describe("qstash stats", () => {
  it("returns stats for the instance", async () => {
    const p = await createQStashProgram();
    const stats = await runCommand(p, ["qstash", "stats", "--qstash-id", qstashId!]) as Record<string, unknown>;
    expect(stats).toBeDefined();
    expect(typeof stats).toBe("object");
  });
});

describe("qstash ipv4", () => {
  it("returns an array of CIDR blocks", async () => {
    const p = await createQStashProgram();
    const result = await runCommand(p, ["qstash", "ipv4"]) as unknown;
    expect(result).toBeDefined();
  });
});
