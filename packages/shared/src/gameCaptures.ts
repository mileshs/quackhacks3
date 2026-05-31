import { z } from "zod";

const dataUrlSchema = z
  .string()
  .min(32)
  .refine((value) => value.startsWith("data:image/"), "Expected a data:image/ URL");

export const createGameCaptureSchema = z.object({
  sessionKey: z.string().trim().min(1).max(128),
  snapshotDataUrl: dataUrlSchema,
  screenshotDataUrl: dataUrlSchema,
  matchPercent: z.number().min(0).max(100).optional()
});

export type CreateGameCapture = z.infer<typeof createGameCaptureSchema>;

export type GameCaptureFrame = {
  roundIndex: number;
  poseName: string;
  snapshotDataUrl: string;
  screenshotDataUrl: string;
  matchPercent: number;
  createdAt: string;
};

export type GameCaptureGallery = {
  sessionKey: string;
  frames: GameCaptureFrame[];
  updatedAt: string;
};

export const appendGameCaptureFrameSchema = z.object({
  roundIndex: z.number().int().min(1).max(999),
  poseName: z.string().trim().min(1).max(128),
  snapshotDataUrl: dataUrlSchema,
  screenshotDataUrl: dataUrlSchema,
  matchPercent: z.number().min(0).max(100)
});

export type AppendGameCaptureFrame = z.infer<typeof appendGameCaptureFrameSchema>;

/** @deprecated Single-frame capture kept for older clients. */
export type GameCapture = {
  sessionKey: string;
  snapshotDataUrl: string;
  screenshotDataUrl: string;
  matchPercent: number | null;
  createdAt: string;
};
