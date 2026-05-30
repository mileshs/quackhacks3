import Database, { type Database as DatabaseType } from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { LeaderboardEntry, SubmitScore } from "@quackhacks/shared";

const DB_PATH = process.env.DB_PATH ?? resolve(process.cwd(), "data/quackhacks.sqlite");

mkdirSync(dirname(DB_PATH), { recursive: true });

export const db: DatabaseType = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

// Schema. Kept minimal for now — just enough to prove storage works.
db.exec(`
  CREATE TABLE IF NOT EXISTS leaderboard (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    NOT NULL,
    score        INTEGER NOT NULL DEFAULT 0,
    survivalTime REAL    NOT NULL DEFAULT 0,
    createdAt    TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

const insertStmt = db.prepare(
  `INSERT INTO leaderboard (name, score, survivalTime) VALUES (@name, @score, @survivalTime)`
);
const topStmt = db.prepare(
  `SELECT * FROM leaderboard ORDER BY score DESC, survivalTime DESC LIMIT ?`
);

export function addScore(entry: SubmitScore): LeaderboardEntry {
  const info = insertStmt.run(entry);
  return db
    .prepare(`SELECT * FROM leaderboard WHERE id = ?`)
    .get(info.lastInsertRowid) as LeaderboardEntry;
}

export function topScores(limit = 10): LeaderboardEntry[] {
  return topStmt.all(limit) as LeaderboardEntry[];
}
