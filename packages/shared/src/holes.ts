import type { UniversalPose } from "./types.js";

/**
 * The hole in the wall is carved by sweeping a radius along each limb and around
 * each joint of the target pose (see design notes). Difficulty controls that radius:
 * easier poses cut a roomier silhouette, spicy poses leave little margin.
 *
 * Values are fractions of the universal box's smaller dimension (width), so callers
 * multiply by the rendered width to get pixels.
 */
export const holeRadiusForDifficulty: Record<UniversalPose["difficulty"], number> = {
  warmup: 0.11,
  standard: 0.085,
  spicy: 0.06
};

/** Convenience lookup with a safe fallback for unknown difficulties. */
export function holeRadius(difficulty: UniversalPose["difficulty"]): number {
  return holeRadiusForDifficulty[difficulty] ?? holeRadiusForDifficulty.standard;
}
