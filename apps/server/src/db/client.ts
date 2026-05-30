import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema.js";

let client: Client | undefined;
let database: LibSQLDatabase<typeof schema> | undefined;

export function getDatabasePath() {
  return resolve(process.cwd(), process.env.SQLITE_PATH ?? "data/quackhacks.sqlite");
}

export function getDatabaseUrl() {
  return `file:${getDatabasePath().replaceAll("\\", "/")}`;
}

export function ensureDatabase() {
  if (database) {
    return database;
  }

  const databasePath = getDatabasePath();
  mkdirSync(dirname(databasePath), { recursive: true });

  client = createClient({ url: getDatabaseUrl() });
  database = drizzle(client, { schema });

  return database;
}

export function closeDatabase() {
  client?.close();
  client = undefined;
  database = undefined;
}
