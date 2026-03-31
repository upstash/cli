import { describe, expect, it } from "vitest";
import { parseCommand } from "../../src/commands/redis/exec.js";

describe("parseCommand", () => {
  it("splits simple tokens", () => {
    expect(parseCommand("SET key value")).toEqual(["SET", "key", "value"]);
  });

  it("handles double-quoted string with spaces", () => {
    expect(parseCommand('SET key "hello world"')).toEqual(["SET", "key", "hello world"]);
  });

  it("handles single-quoted string with spaces", () => {
    expect(parseCommand("SET key 'hello world'")).toEqual(["SET", "key", "hello world"]);
  });

  it("strips surrounding quotes", () => {
    expect(parseCommand('"SET" key')).toEqual(["SET", "key"]);
  });

  it("returns empty array for empty string", () => {
    expect(parseCommand("")).toEqual([]);
  });

  it("ignores extra spaces between tokens", () => {
    expect(parseCommand("SET  key  value")).toEqual(["SET", "key", "value"]);
  });

  it("handles single quotes inside double-quoted string", () => {
    expect(parseCommand(`SET key "it's fine"`)).toEqual(["SET", "key", "it's fine"]);
  });

  it("handles double quotes inside single-quoted string", () => {
    expect(parseCommand(`SET key 'say "hello"'`)).toEqual(["SET", "key", 'say "hello"']);
  });

  it("handles single token with no spaces", () => {
    expect(parseCommand("PING")).toEqual(["PING"]);
  });
});
