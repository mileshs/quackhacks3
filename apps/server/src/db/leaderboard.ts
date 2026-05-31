import { asc, count, desc, eq } from "drizzle-orm";
import type { CreateLeaderboardEntry, LeaderboardEntry } from "@quackhacks/shared";
import { ensureDatabase, getDatabasePath } from "./client.js";
import { leaderboardEntries } from "./schema.js";

export { getDatabasePath };

export async function countLeaderboardEntries() {
  const [row] = await ensureDatabase()
    .select({ value: count() })
    .from(leaderboardEntries);

  return row?.value ?? 0;
}

export async function listLeaderboardEntries() {
  return ensureDatabase()
    .select({
      id: leaderboardEntries.id,
      playerName: leaderboardEntries.playerName,
      score: leaderboardEntries.score,
      accuracy: leaderboardEntries.accuracy,
      survivalSeconds: leaderboardEntries.survivalSeconds,
      createdAt: leaderboardEntries.createdAt
    })
    .from(leaderboardEntries)
    .orderBy(
      desc(leaderboardEntries.score),
      desc(leaderboardEntries.survivalSeconds),
      asc(leaderboardEntries.createdAt)
    )
    .limit(10) satisfies Promise<LeaderboardEntry[]>;
}

export async function createLeaderboardEntry(input: CreateLeaderboardEntry) {
  const now = new Date().toISOString();
  const [entry] = await ensureDatabase()
    .insert(leaderboardEntries)
    .values({
      playerName: input.playerName,
      score: input.score,
      accuracy: input.accuracy,
      survivalSeconds: input.survivalSeconds,
      createdAt: now
    })
    .returning({
      id: leaderboardEntries.id,
      playerName: leaderboardEntries.playerName,
      score: leaderboardEntries.score,
      accuracy: leaderboardEntries.accuracy,
      survivalSeconds: leaderboardEntries.survivalSeconds,
      createdAt: leaderboardEntries.createdAt
    });

  return entry;
}

export async function getLeaderboardEntry(id: number) {
  const [entry] = await ensureDatabase()
    .select({
      id: leaderboardEntries.id,
      playerName: leaderboardEntries.playerName,
      score: leaderboardEntries.score,
      accuracy: leaderboardEntries.accuracy,
      survivalSeconds: leaderboardEntries.survivalSeconds,
      createdAt: leaderboardEntries.createdAt
    })
    .from(leaderboardEntries)
    .where(eq(leaderboardEntries.id, id))
    .limit(1);

  return entry;
}
