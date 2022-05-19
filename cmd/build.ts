import { build, emptyDir } from "https://deno.land/x/dnt@0.23.0/mod.ts";

const packageManager = "npm";
const outDir = "./dist";
const version = Deno.args[0] ?? "development";

await emptyDir(outDir);

Deno.writeTextFileSync(
  "./src/version.ts",
  `export const VERSION = "${version}"`,
);

await build({
  packageManager,
  entryPoints: [{ kind: "bin", name: "upstash", path: "src/mod.ts" }],
  outDir,
  shims: {
    deno: true,
    // undici: true,
    custom: [
      {
        package: { name: "node-fetch", version: "latest" },
        globalNames: [{ name: "fetch", exportName: "default" }],
      },
    ],
  },

  scriptModule: false,
  declaration: false,
  typeCheck: false,
  test: typeof Deno.env.get("TEST") !== "undefined",
  package: {
    // package.json properties
    name: "@upstash/cli",
    version,
    description: "CLI for Upstash resources.",
    repository: {
      type: "git",
      url: "git+https://github.com/upstash/cli.git",
    },
    keywords: ["cli", "redis", "kafka", "serverless", "edge", "upstash"],
    contributors: [
      {
        name: "Andreas Thomas",
        email: "dev@chronark.com",
      },
    ],
    license: "MIT",
    bugs: {
      url: "https://github.com/upstash/cli/issues",
    },
    homepage: "https://github.com/upstash/cli#readme",
  },
});
Deno.writeTextFileSync(
  "./src/version.ts",
  `// This is set during build
export const VERSION = "development";`,
);

// post build steps
Deno.copyFileSync("LICENSE", `${outDir}/LICENSE`);
Deno.copyFileSync("README.md", `${outDir}/README.md`);
