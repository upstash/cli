import { Command } from "commander";
import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BucketResolver, tokenBucketId } from "../../src/commands/blob/buckets.js";
import { needsSync } from "../../src/commands/blob/sync.js";
import {
  claimLocal,
  destinationFor,
  dirPrefix,
  globToRegExp,
  isIncluded,
  listBlobs,
  localRel,
  parseLocation,
} from "../../src/commands/blob/transfer.js";
import type { Entry } from "../../src/commands/blob/transfer.js";
import { createBlobProgram, runCommand } from "../helpers/program.js";

let directory: string;
const originalEnv = { ...process.env };

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "blob-s3-test-"));
  delete process.env.UPSTASH_BLOB_TOKEN;
  delete process.env.UPSTASH_EMAIL;
  delete process.env.UPSTASH_API_KEY;
  process.env.UPSTASH_CONFIG_HOME = directory;
  process.env.UPSTASH_LEGACY_CONFIG_HOME = directory;
  vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Unexpected network request in offline test"));
});

afterEach(async () => {
  vi.restoreAllMocks();
  process.env = { ...originalEnv };
  await rm(directory, { recursive: true, force: true });
});

function token(id: string = randomUUID()): string {
  const bucket = Buffer.from(id);
  const password = Buffer.from("fixture-password");
  const hash = Buffer.from("fixture");
  return Buffer.concat([Buffer.from([2, 0, bucket.length, 0, password.length, hash.length]), bucket, password, hash]).toString("base64url");
}

function entry(rel: string, size = 1, mtime = 0): Entry {
  return { rel, size, mtime, location: { type: "local", path: rel } };
}

describe("locations", () => {
  it("parses blob URIs and local paths", () => {
    expect(parseLocation("blob://bucket/a/b.txt")).toEqual({ type: "blob", bucket: "bucket", key: "a/b.txt" });
    expect(parseLocation("blob://bucket")).toEqual({ type: "blob", bucket: "bucket", key: "" });
    expect(parseLocation("./dir")).toEqual({ type: "local", path: "./dir" });
    expect(() => parseLocation("s3://bucket/key")).toThrow("unsupported location");
    expect(() => parseLocation("blob:///key")).toThrow("has no bucket");
  });

  it("treats recursive sources as directories", () => {
    expect(dirPrefix("")).toBe("");
    expect(dirPrefix("images")).toBe("images/");
    expect(dirPrefix("images/")).toBe("images/");
  });

  it("maps entries to destinations like aws s3", () => {
    const blob = { type: "blob" as const, bucket: "b", key: "site" };
    expect(destinationFor(entry("sub/a.txt"), blob, true)).toEqual({ type: "blob", bucket: "b", key: "site/sub/a.txt" });
    expect(destinationFor(entry("a.txt"), blob, false)).toEqual(blob);
    expect(destinationFor(entry("a.txt"), { ...blob, key: "" }, true)).toMatchObject({ key: "a.txt" });
    expect(destinationFor(entry("sub/a.txt"), { type: "local", path: "out" }, true)).toEqual({ type: "local", path: join("out", "sub", "a.txt") });
  });

  it("refuses keys that would escape the local destination", () => {
    for (const rel of ["../escape.txt", "a/../../escape.txt", ".."]) {
      expect(() => destinationFor(entry(rel), { type: "local", path: directory }, true)).toThrow("outside");
    }
  });
});

describe("local collisions", () => {
  it("normalizes keys the way the local listing reports them", () => {
    expect(localRel("/a.txt")).toBe("a.txt");
    expect(localRel("a//b/./c")).toBe("a/b/c");
    expect(localRel("a/b")).toBe("a/b");
  });

  it("lets only one key write a local file, ignoring case", () => {
    const claimed = new Set<string>();
    claimLocal(claimed, { type: "local", path: join(directory, "README.md") });
    expect(() => claimLocal(claimed, { type: "local", path: join(directory, "readme.md") })).toThrow("also written");
    expect(() => claimLocal(claimed, { type: "blob", bucket: "b", key: "README.md" })).not.toThrow();
  });
});

describe("folder markers", () => {
  const listing = {
    list: async () => ({
      cursor: undefined,
      blobs: [
        { path: "tmp/", size: 0, etag: "", uploadedAt: new Date(0) },
        { path: "tmp/sub/", size: 0, etag: "", uploadedAt: new Date(0) },
        { path: "tmp/x.txt", size: 1, etag: "", uploadedAt: new Date(0) },
      ],
    }),
  } as unknown as Parameters<typeof listBlobs>[0];
  const location = { type: "blob" as const, bucket: "b", key: "tmp" };

  it("skips zero-byte markers except when deleting", async () => {
    expect((await listBlobs(listing, location, "tmp/")).map((e) => e.rel)).toEqual(["x.txt"]);
    expect((await listBlobs(listing, location, "tmp/", true)).map((e) => e.rel)).toEqual(["", "sub/", "x.txt"]);
  });
});

describe("filters", () => {
  it("matches fnmatch patterns where * crosses slashes", () => {
    expect(globToRegExp("*.txt").test("dir/a.txt")).toBe(true);
    expect(globToRegExp("a?c").test("abc")).toBe(true);
    expect(globToRegExp("[!a]b").test("ab")).toBe(false);
    expect(globToRegExp("[!a]b").test("cb")).toBe(true);
    expect(globToRegExp("[]]x").test("]x")).toBe(true);
    expect(globToRegExp("a.b(c)").test("a.b(c)")).toBe(true);
    expect(globToRegExp("a.b").test("axb")).toBe(false);
  });

  it("lets the last matching filter win", () => {
    const filters = [
      { exclude: true, match: globToRegExp("*") },
      { exclude: false, match: globToRegExp("*.json") },
    ];
    expect(isIncluded("x/a.json", filters)).toBe(true);
    expect(isIncluded("x/a.txt", filters)).toBe(false);
    expect(isIncluded("anything", [])).toBe(true);
  });

  it("keeps --exclude and --include in command-line order", async () => {
    await writeFile(join(directory, "a.json"), "{}");
    await writeFile(join(directory, "b.txt"), "b");
    const result = await runCommand(await createBlobProgram(), [
      "blob", "cp", directory, "blob://bucket/dest", "--recursive",
      "--exclude", "*", "--include", "*.json", "--dryrun", "--quiet",
    ]);
    expect(result).toEqual({
      dry_run: true,
      operations: [{
        action: "upload",
        source: join(directory, "a.json"),
        destination: "blob://bucket/dest/a.json",
        size: 2,
      }],
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("sync comparison", () => {
  const at = (seconds: number, size = 1): Entry => entry("a", size, seconds * 1000);

  it("copies uploads and copies when the size differs or the source is newer", () => {
    expect(needsSync(at(10, 1), at(10, 2), "upload", {})).toBe(true);
    expect(needsSync(at(11), at(10), "upload", {})).toBe(true);
    expect(needsSync(at(10), at(11), "copy", {})).toBe(false);
    expect(needsSync(at(10.9), at(10.1), "upload", {})).toBe(false);
    expect(needsSync(at(11), at(10), "upload", { sizeOnly: true })).toBe(false);
  });

  it("skips same-sized downloads unless the local file is newer, as aws does", () => {
    expect(needsSync(at(11), at(10), "download", {})).toBe(false);
    expect(needsSync(at(10), at(11), "download", {})).toBe(true);
    expect(needsSync(at(11), at(10), "download", { exactTimestamps: true })).toBe(true);
    expect(needsSync(at(10), at(10), "download", { exactTimestamps: true })).toBe(false);
  });
});

describe("bucket resolution", () => {
  it("reads the bucket id from a token", () => {
    const id = randomUUID();
    expect(tokenBucketId(token(id))).toBe(id);
    expect(tokenBucketId("x")).toBeUndefined();
  });

  it("uses a token only for the bucket it was issued for", async () => {
    const id = randomUUID();
    process.env.UPSTASH_BLOB_TOKEN = token(id);
    const resolver = new BucketResolver(new Command());
    await expect(resolver.open(id)).resolves.toBeDefined();
    await expect(resolver.open("some-name")).rejects.toThrow(`The Blob token is for bucket ${id}, not "some-name"`);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("prefers the explicit token over the environment", async () => {
    const id = randomUUID();
    process.env.UPSTASH_BLOB_TOKEN = token();
    await expect(new BucketResolver(new Command(), token(id)).open(id)).resolves.toBeDefined();
  });
});

describe("argument checks", () => {
  it("rejects local-to-local copies and directories without --recursive", async () => {
    await mkdir(join(directory, "d"));
    const program = await createBlobProgram();
    await expect(runCommand(program, ["blob", "cp", "a", "b"])).rejects.toThrow("must be a blob://");
    await expect(runCommand(await createBlobProgram(), ["blob", "cp", join(directory, "d"), "blob://b/x"]))
      .rejects.toThrow("is a directory; use --recursive");
    await expect(runCommand(await createBlobProgram(), ["blob", "rm", "blob://b"])).rejects.toThrow("names no object");
    await expect(runCommand(await createBlobProgram(), ["blob", "presign", "blob://b/k", "--expires-in", "0"]))
      .rejects.toThrow();
    await expect(runCommand(await createBlobProgram(), ["blob", "mb", "blob://b/key"])).rejects.toThrow("includes a key");
  });
});
