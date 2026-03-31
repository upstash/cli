import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTeamProgram, runCommand } from "../helpers/program.js";
import type { Team, TeamMember } from "../../src/types.js";

const TEST_NAME = `cli-test-${Date.now()}`;
let teamId: string | undefined;

beforeAll(async () => {
  const p = await createTeamProgram();
  const team = await runCommand(p, ["team", "create", "--name", TEST_NAME]) as Team;
  expect(team.team_id).toBeDefined();
  teamId = team.team_id;
});

afterAll(async () => {
  if (!teamId) return;
  const p = await createTeamProgram();
  await runCommand(p, ["team", "delete", "--team-id", teamId]);
});

describe("team list", () => {
  it("includes the created team", async () => {
    const p = await createTeamProgram();
    const teams = await runCommand(p, ["team", "list"]) as Team[];
    expect(Array.isArray(teams)).toBe(true);
    expect(teams.some((t) => t.team_id === teamId)).toBe(true);
  });
});

describe("team members", () => {
  it("returns the owner as a member", async () => {
    const p = await createTeamProgram();
    const members = await runCommand(p, ["team", "members", "--team-id", teamId!]) as TeamMember[];
    expect(Array.isArray(members)).toBe(true);
    expect(members.length).toBeGreaterThan(0);
    const owner = members.find((m) => m.member_role === "owner");
    expect(owner).toBeDefined();
    expect(owner?.member_email).toBeDefined();
  });
});

describe("team delete dry-run", () => {
  it("returns dry_run: true without deleting", async () => {
    const p = await createTeamProgram();
    const result = await runCommand(p, ["team", "delete", "--team-id", teamId!, "--dry-run"]) as Record<string, unknown>;
    expect(result["dry_run"]).toBe(true);
    expect(result["team_id"]).toBe(teamId);
  });
});
