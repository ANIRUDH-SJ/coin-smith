import * as esbuild from "esbuild";
import { copyFile, mkdir } from "fs/promises";
import { join } from "path";

const outDir = "web";

async function build() {
  await mkdir(outDir, { recursive: true });

  await esbuild.build({
    entryPoints: ["src/web/index.tsx"],
    bundle: true,
    outfile: join(outDir, "bundle.js"),
    minify: true,
    target: ["es2020"],
    platform: "browser",
    define: { "process.env.NODE_ENV": '"production"' },
  });

  console.log("Built web/bundle.js");
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
