import { describe, expect, it } from "vitest";
import { withDefaultCommand } from "../../src/short-name.js";

describe("the `upstash` short name", () => {
  it("runs setup for a bare `upstash` in a terminal", () => {
    expect(withDefaultCommand("upstash", [], true)).toEqual(["setup"]);
  });

  it("keeps the help for a bare `upstash` outside a terminal, so agents never trigger setup", () => {
    expect(withDefaultCommand("upstash", [], false)).toEqual([]);
  });

  it("passes every other invocation through unchanged", () => {
    expect(withDefaultCommand("upstash", ["redis", "list"], true)).toEqual(["redis", "list"]);
    expect(withDefaultCommand("upstash", ["--version"], true)).toEqual(["--version"]);
  });

  it("leaves @upstash/cli as it is", () => {
    expect(withDefaultCommand("@upstash/cli", [], true)).toEqual([]);
  });
});
