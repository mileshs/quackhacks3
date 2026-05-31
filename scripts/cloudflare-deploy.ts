import { pnpm, wrangler } from "./cloudflare-shared.ts";

const skipBuild = process.argv.includes("--skip-build");

if (!skipBuild) {
  pnpm(["build"]);
}

wrangler(["d1", "migrations", "apply", "DB", "--remote", "--config", "wrangler.jsonc"]);
wrangler(["deploy", "--config", "wrangler.jsonc"]);
