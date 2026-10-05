import { describe, expect, it } from "vitest";
import { withDefaultCommand } from "../../src/default-command.js";

describe("bare `upstash`", () => {
  it("runs setup in a terminal", () => {
    expect(withDefaultCommand([], true)).toEqual(["setup"]);
  });

  it("keeps the help outside a terminal, so agents never trigger setup", () => {
    expect(withDefaultCommand([], false)).toEqual([]);
  });

  it("passes every other invocation through unchanged", () => {
    expect(withDefaultCommand(["redis", "list"], true)).toEqual(["redis", "list"]);
    expect(withDefaultCommand(["--version"], true)).toEqual(["--version"]);
  });
});
