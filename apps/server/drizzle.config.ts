import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { defineConfig } from "drizzle-kit";

const sqlitePath = resolve(process.cwd(), process.env.SQLITE_PATH ?? "data/quackhacks.sqlite");
mkdirSync(dirname(sqlitePath), { recursive: true });

export default defineConfig({
  schema: "./src/db/schema.ts",
  dialect: "sqlite",
  dbCredentials: {
    url: `file:${sqlitePath.replaceAll("\\", "/")}`
  }
});
