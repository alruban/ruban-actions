const { dirname } = require("path");
const { fdir } = require("fdir");
const esbuild = require("esbuild");

const actionEntries = new fdir()
  .withFullPaths()
  .withMaxDepth(1)
  .glob("**/index.ts")
  .crawl("./.github/actions/")
  .sync();

for (const actionEntry of actionEntries) {
  esbuild
    .build({
      bundle: true,
      entryPoints: [actionEntry],
      minify: true,
      format: "cjs",
      outfile: dirname(actionEntry) + "/index.js",
      platform: "node",
      target: "node18",
      sourcemap: true,
    })
    .catch(() => process.exit(1));
}
