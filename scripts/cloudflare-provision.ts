import {
  accountId,
  databaseName,
  extractJson,
  readJson,
  workerName,
  wrangler,
  wranglerPath,
  writeJson,
  type WranglerConfig
} from "./cloudflare-shared.ts";

type D1Database = {
  name: string;
  uuid: string;
};

function listD1Databases() {
  const { stdout } = wrangler(["d1", "list", "--json"], { capture: true });
  return extractJson<D1Database[]>(stdout);
}

function ensureD1Database() {
  const existing = listD1Databases().find((database) => database.name === databaseName);
  if (existing) {
    return existing.uuid;
  }

  const { stdout } = wrangler(["d1", "create", databaseName], { capture: true });
  const createdId = stdout.match(/"database_id":\s*"([^"]+)"/)?.[1];
  if (!createdId) {
    throw new Error(`Created D1 database ${databaseName}, but could not find its database_id in Wrangler output.`);
  }

  return createdId;
}

const databaseId = ensureD1Database();
const config = readJson<WranglerConfig>(wranglerPath);
config.name = workerName;
config.account_id = accountId;
config.d1_databases = config.d1_databases.filter(
  (database, index, databases) =>
    database.binding !== "DB" || databases.findIndex((candidate) => candidate.binding === "DB") === index
);

const dbBinding = config.d1_databases.find((database) => database.binding === "DB");
if (!dbBinding) {
  throw new Error("wrangler.jsonc is missing the DB D1 binding.");
}

dbBinding.database_name = databaseName;
dbBinding.database_id = databaseId;

writeJson(wranglerPath, config);

console.log(`Cloudflare account: ${accountId}`);
console.log(`Worker: ${workerName}`);
console.log(`D1 ${databaseName}: ${databaseId}`);
