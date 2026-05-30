import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const leaderboardEntries = sqliteTable("leaderboard_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  playerName: text("player_name").notNull(),
  score: integer("score").notNull(),
  accuracy: real("accuracy").notNull(),
  survivalSeconds: integer("survival_seconds").notNull(),
  createdAt: text("created_at").notNull()
});
