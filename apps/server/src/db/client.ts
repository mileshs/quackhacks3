/// <reference path="../worker-configuration.d.ts" />

import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema.js";

export function getDatabase() {
  return drizzle(env.DB, { schema });
}

export function getDatabaseBindingName() {
  return "DB";
}
