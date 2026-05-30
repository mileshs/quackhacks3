import { z } from "zod";

export const createLeaderboardEntrySchema = z.object({
  playerName: z.string().trim().min(1).max(24),
  score: z.number().int().min(0).max(999_999),
  accuracy: z.number().min(0).max(100),
  survivalSeconds: z.number().int().min(0).max(60 * 60)
});

export type CreateLeaderboardEntry = z.infer<typeof createLeaderboardEntrySchema>;

export type LeaderboardEntry = CreateLeaderboardEntry & {
  id: number;
  createdAt: string;
};
