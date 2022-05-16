import { build, emptyDir } from "https://deno.land/x/dnt@0.23.0/mod.ts";

const packageManager = "npm";
const outDir = "./dist";
const version = Deno.args[0];

await emptyDir(outDir);

await build({
  packageManager,
  entryPoints: [{ kind: "bin", name: "upstash", path: "src/mod.ts" }],
  outDir,
  shims: {
    deno: true,
    crypto: true,
  },

  scriptModule: false,
  typeCheck: false,
  test: typeof Deno.env.get("TEST") !== "undefined",
  package: {
    // package.json properties
    name: "@upstash/cli",
    version,
    description:
      "An HTTP/REST based Redis client built on top of Upstash REST API.",
    repository: {
      type: "git",
      url: "git+https://github.com/upstash/upstash-redis.git",
    },
    keywords: ["redis", "database", "serverless", "edge", "upstash"],
    contributors: [
      {
        name: "Andreas Thomas",
        email: "dev@chronark.com",
      },
    ],
    license: "MIT",
    bugs: {
      url: "https://github.com/upstash/upstash-cli/issues",
    },
    homepage: "https://github.com/upstash/upstash-cli#readme",
  },
});
Deno.writeTextFileSync(
  "./dist/src/version.ts",
  `export const VERSION = "${version}"`
);

// post build steps
Deno.copyFileSync("LICENSE", `${outDir}/LICENSE`);
Deno.copyFileSync("README.md", `${outDir}/README.md`);
