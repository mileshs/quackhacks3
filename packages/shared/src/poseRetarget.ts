import type { JointName, UniversalJoint, UniversalPose } from "./types.js";

/** Kinematic parent of each joint (root = hips). */
const RETARGET_PARENTS: Record<JointName, JointName | null> = {
  hips: null,
  neck: "hips",
  head: "neck",
  leftShoulder: "neck",
  rightShoulder: "neck",
  leftElbow: "leftShoulder",
  rightElbow: "rightShoulder",
  leftWrist: "leftElbow",
  rightWrist: "rightElbow",
  leftKnee: "hips",
  rightKnee: "hips",
  leftAnkle: "leftKnee",
  rightAnkle: "rightKnee"
};

/** Placement order so every joint's parent is positioned before it. */
const RETARGET_ORDER: JointName[] = [
  "hips",
  "neck",
  "head",
  "leftShoulder",
  "rightShoulder",
  "leftElbow",
  "rightElbow",
  "leftWrist",
  "rightWrist",
  "leftKnee",
  "rightKnee",
  "leftAnkle",
  "rightAnkle"
];

/**
 * Rebuild `source` using the bone lengths and hip anchor of `lengthsFrom`, but keeping
 * each joint's angle relative to its parent from `source`.
 *
 * This is the "universal puppet": a player of any real-world proportions is expressed
 * with the exact same bone lengths as the target hole, so when their joint angles match
 * the target the dummy lands precisely on the outline (and the score reflects pure
 * angular accuracy, independent of body size). Joints that are missing in either pose
 * (e.g. low visibility) are dropped along with their descendants.
 */
export function retargetPose(source: UniversalPose, lengthsFrom: UniversalPose): UniversalPose {
  const srcMap = new Map(source.joints.map((joint) => [joint.name, joint]));
  const lenMap = new Map(lengthsFrom.joints.map((joint) => [joint.name, joint]));
  const importanceMap = new Map(source.joints.map((joint) => [joint.name, joint.importance]));
  const placed = new Map<JointName, { x: number; y: number }>();

  // Anchor the hips at the target's hips so the puppet lines up with the hole.
  const anchor = lenMap.get("hips") ?? srcMap.get("hips");
  if (srcMap.has("hips") && anchor) {
    placed.set("hips", { x: anchor.x, y: anchor.y });
  }

  for (const name of RETARGET_ORDER) {
    const parentName = RETARGET_PARENTS[name];
    if (!parentName) {
      continue;
    }

    const placedParent = placed.get(parentName);
    const srcChild = srcMap.get(name);
    const srcParent = srcMap.get(parentName);
    const lenChild = lenMap.get(name);
    const lenParent = lenMap.get(parentName);
    if (!placedParent || !srcChild || !srcParent || !lenChild || !lenParent) {
      continue;
    }

    const length = Math.hypot(lenChild.x - lenParent.x, lenChild.y - lenParent.y);
    const angle = Math.atan2(srcChild.y - srcParent.y, srcChild.x - srcParent.x);
    placed.set(name, {
      x: placedParent.x + Math.cos(angle) * length,
      y: placedParent.y + Math.sin(angle) * length
    });
  }

  const joints: UniversalJoint[] = [];
  for (const name of RETARGET_ORDER) {
    const point = placed.get(name);
    if (!point) {
      continue;
    }
    joints.push({ name, x: point.x, y: point.y, importance: importanceMap.get(name) ?? 1 });
  }

  return { ...source, joints };
}
