import type { JointName, UniversalPose } from "./types.js";

/**
 * Compares a live universal pose against a target pose and returns a 0–100 match %.
 *
 * Both poses live in the same normalized universal box, so we can compare joint
 * positions directly. Each joint's positional error is converted to a per-joint
 * score, then combined as an importance-weighted average — torso/anchor joints
 * count more than noisy wrists, matching the design notes.
 *
 * @param tolerance  Distance (in box fractions) at which a joint scores ~0. Larger
 *                   = more forgiving. Default 0.22 ≈ a fifth of the box.
 */
export function comparePoses(
  live: UniversalPose,
  target: UniversalPose,
  tolerance = 0.22
): number {
  const liveByName = new Map<JointName, { x: number; y: number }>(
    live.joints.map((joint) => [joint.name, { x: joint.x, y: joint.y }])
  );

  let weightedScore = 0;
  let weightTotal = 0;

  for (const targetJoint of target.joints) {
    const liveJoint = liveByName.get(targetJoint.name);
    const weight = targetJoint.importance;
    weightTotal += weight;

    if (!liveJoint) {
      // Missing joint (off-screen / low confidence) scores zero but still counts,
      // so hiding a limb can't game the match.
      continue;
    }

    const error = Math.hypot(liveJoint.x - targetJoint.x, liveJoint.y - targetJoint.y);
    const jointScore = Math.max(0, 1 - error / tolerance);
    weightedScore += jointScore * weight;
  }

  if (weightTotal === 0) {
    return 0;
  }

  return Math.round((weightedScore / weightTotal) * 100);
}
