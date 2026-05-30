import { universalHumanSize } from "./poses.js";
import type { JointName, UniversalJoint, UniversalPose } from "./types.js";

/**
 * MediaPipe BlazePose (Pose Landmarker) landmark indices we care about.
 * Full list: https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker
 */
export const MEDIAPIPE_POSE_INDEX = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28
} as const;

/** Minimal shape of a MediaPipe normalized landmark (x/y in [0,1] of the image). */
export type Landmark = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};

/** Importance weights mirror the saboteur starter poses: torso/anchors matter most. */
const JOINT_IMPORTANCE: Record<JointName, number> = {
  head: 0.8,
  neck: 1,
  leftShoulder: 1,
  rightShoulder: 1,
  leftElbow: 0.8,
  rightElbow: 0.8,
  leftWrist: 0.6,
  rightWrist: 0.6,
  hips: 1,
  leftKnee: 0.9,
  rightKnee: 0.9,
  leftAnkle: 1,
  rightAnkle: 1
};

/**
 * Where the dummy is anchored inside the universal box and how long its torso is,
 * expressed as fractions. These match the saboteur's starter poses (hips ~0.55,
 * neck ~0.22 → torso ~0.33 of the box height) so live + target share one space.
 */
const HIPS_ANCHOR = { x: 0.5, y: 0.55 } as const;
const TARGET_TORSO = 0.33;
const ASPECT_CORRECTION = universalHumanSize.height / universalHumanSize.width;

type SquarePoint = { x: number; y: number };

function midpoint(a: SquarePoint, b: SquarePoint): SquarePoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function distance(a: SquarePoint, b: SquarePoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Convert a MediaPipe landmark into an aspect-corrected unit space where 1 unit on
 * both axes equals the image height. This keeps real-world angles intact regardless
 * of the camera's 16:9 (or other) framing before we normalize by torso length.
 */
function squarePoint(landmark: Landmark, aspect: number): SquarePoint {
  return { x: landmark.x * aspect, y: landmark.y };
}

/**
 * Maps a set of MediaPipe pose landmarks onto the fixed-size universal dummy.
 *
 * Body-size independence: we translate so the hips sit at a fixed anchor and scale
 * everything by the live torso length, so a tall and a short player who strike the
 * same pose produce the same dummy. No calibration phase required.
 *
 * @param landmarks  The 33 normalized landmarks from PoseLandmarker.
 * @param aspect     Video width / height (used to undo non-square framing).
 * @returns A UniversalPose, or null if the core torso landmarks are missing.
 */
export function landmarksToUniversalPose(
  landmarks: Landmark[],
  aspect: number,
  options: { id?: string; name?: string; minVisibility?: number; mirror?: boolean } = {}
): UniversalPose | null {
  const { id = "live", name = "Live Athlete", minVisibility = 0.4, mirror = false } = options;

  const idx = MEDIAPIPE_POSE_INDEX;
  const get = (i: number): Landmark | undefined => landmarks[i];

  const lShoulder = get(idx.leftShoulder);
  const rShoulder = get(idx.rightShoulder);
  const lHip = get(idx.leftHip);
  const rHip = get(idx.rightHip);

  if (!lShoulder || !rShoulder || !lHip || !rHip) {
    return null;
  }

  const sp = (lm: Landmark) => squarePoint(lm, aspect);
  const neck = midpoint(sp(lShoulder), sp(rShoulder));
  const hips = midpoint(sp(lHip), sp(rHip));
  const torso = distance(neck, hips);

  if (torso < 1e-4) {
    return null;
  }

  const scale = TARGET_TORSO / torso;

  // Offsets are measured in image-height units; converting to box fractions means
  // y maps directly while x is corrected for the box's portrait aspect ratio.
  // `mirror` flips the dummy horizontally so a selfie-mirrored camera lines up with
  // the saboteur's screen-left convention (the player's left appears on the left).
  const toUniversal = (point: SquarePoint) => {
    const x = HIPS_ANCHOR.x + (point.x - hips.x) * scale * ASPECT_CORRECTION;
    return {
      x: mirror ? 1 - x : x,
      y: HIPS_ANCHOR.y + (point.y - hips.y) * scale
    };
  };

  const sources: Record<JointName, SquarePoint | undefined> = {
    head: get(idx.nose) ? sp(get(idx.nose)!) : undefined,
    neck,
    leftShoulder: sp(lShoulder),
    rightShoulder: sp(rShoulder),
    leftElbow: get(idx.leftElbow) ? sp(get(idx.leftElbow)!) : undefined,
    rightElbow: get(idx.rightElbow) ? sp(get(idx.rightElbow)!) : undefined,
    leftWrist: get(idx.leftWrist) ? sp(get(idx.leftWrist)!) : undefined,
    rightWrist: get(idx.rightWrist) ? sp(get(idx.rightWrist)!) : undefined,
    hips,
    leftKnee: get(idx.leftKnee) ? sp(get(idx.leftKnee)!) : undefined,
    rightKnee: get(idx.rightKnee) ? sp(get(idx.rightKnee)!) : undefined,
    leftAnkle: get(idx.leftAnkle) ? sp(get(idx.leftAnkle)!) : undefined,
    rightAnkle: get(idx.rightAnkle) ? sp(get(idx.rightAnkle)!) : undefined
  };

  const visibilityFor: Partial<Record<JointName, number>> = {
    head: get(idx.nose)?.visibility,
    leftElbow: get(idx.leftElbow)?.visibility,
    rightElbow: get(idx.rightElbow)?.visibility,
    leftWrist: get(idx.leftWrist)?.visibility,
    rightWrist: get(idx.rightWrist)?.visibility,
    leftKnee: get(idx.leftKnee)?.visibility,
    rightKnee: get(idx.rightKnee)?.visibility,
    leftAnkle: get(idx.leftAnkle)?.visibility,
    rightAnkle: get(idx.rightAnkle)?.visibility
  };

  const joints: UniversalJoint[] = [];
  for (const jointName of Object.keys(JOINT_IMPORTANCE) as JointName[]) {
    const source = sources[jointName];
    if (!source) {
      continue;
    }
    const visibility = visibilityFor[jointName];
    if (visibility !== undefined && visibility < minVisibility) {
      continue;
    }
    const mapped = toUniversal(source);
    joints.push({
      name: jointName,
      x: clamp01(mapped.x),
      y: clamp01(mapped.y),
      importance: JOINT_IMPORTANCE[jointName]
    });
  }

  return { id, name, difficulty: "standard", joints };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
