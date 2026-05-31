import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const leaderboardEntries = sqliteTable("leaderboard_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  playerName: text("player_name").notNull(),
  score: integer("score").notNull(),
  accuracy: real("accuracy").notNull(),
  survivalSeconds: integer("survival_seconds").notNull(),
  createdAt: text("created_at").notNull()
});

export const gameCaptures = sqliteTable("game_captures", {
  sessionKey: text("session_key").primaryKey(),
  snapshotImage: text("snapshot_image").notNull(),
  screenshotImage: text("screenshot_image").notNull(),
  matchPercent: real("match_percent"),
  createdAt: text("created_at").notNull()
});

export const gameCaptureGalleries = sqliteTable("game_capture_galleries", {
  sessionKey: text("session_key").primaryKey(),
  framesJson: text("frames_json").notNull(),
  updatedAt: text("updated_at").notNull()
});
