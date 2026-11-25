import { build } from "esbuild";

// Both functions share one bundle: handlers are lambda.api and lambda.worker.
await build({
  entryPoints: { lambda: "src/lambda.ts" },
  outdir: "dist",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  sourcemap: true,
  logLevel: "info",
});
await build({ entryPoints: ["src/browser.ts"], bundle: true, platform: "browser", format: "iife", target: "es2022", outfile: "site/api.js", logLevel: "info" });
