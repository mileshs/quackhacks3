import type { JointName, UniversalPose } from "./types.js";

export const universalHumanSize = {
  width: 320,
  height: 480
} as const;

export const universalLimbs: Array<[JointName, JointName]> = [
  ["head", "neck"],
  ["neck", "leftShoulder"],
  ["neck", "rightShoulder"],
  ["leftShoulder", "leftElbow"],
  ["leftElbow", "leftWrist"],
  ["rightShoulder", "rightElbow"],
  ["rightElbow", "rightWrist"],
  ["neck", "hips"],
  ["hips", "leftKnee"],
  ["leftKnee", "leftAnkle"],
  ["hips", "rightKnee"],
  ["rightKnee", "rightAnkle"]
];

export const starterPoses: UniversalPose[] = [
  {
    id: "duck-ready",
    name: "Duck Ready",
    difficulty: "warmup",
    joints: [
      { name: "head", x: 0.5, y: 0.12, importance: 0.8 },
      { name: "neck", x: 0.5, y: 0.22, importance: 1 },
      { name: "leftShoulder", x: 0.36, y: 0.25, importance: 1 },
      { name: "rightShoulder", x: 0.64, y: 0.25, importance: 1 },
      { name: "leftElbow", x: 0.28, y: 0.42, importance: 0.8 },
      { name: "rightElbow", x: 0.72, y: 0.42, importance: 0.8 },
      { name: "leftWrist", x: 0.36, y: 0.56, importance: 0.6 },
      { name: "rightWrist", x: 0.64, y: 0.56, importance: 0.6 },
      { name: "hips", x: 0.5, y: 0.55, importance: 1 },
      { name: "leftKnee", x: 0.42, y: 0.75, importance: 0.9 },
      { name: "rightKnee", x: 0.58, y: 0.75, importance: 0.9 },
      { name: "leftAnkle", x: 0.36, y: 0.94, importance: 1 },
      { name: "rightAnkle", x: 0.64, y: 0.94, importance: 1 }
    ]
  },
  {
    id: "side-reach",
    name: "Side Reach",
    difficulty: "standard",
    joints: [
      { name: "head", x: 0.52, y: 0.12, importance: 0.8 },
      { name: "neck", x: 0.52, y: 0.22, importance: 1 },
      { name: "leftShoulder", x: 0.38, y: 0.25, importance: 1 },
      { name: "rightShoulder", x: 0.66, y: 0.25, importance: 1 },
      { name: "leftElbow", x: 0.22, y: 0.3, importance: 0.8 },
      { name: "rightElbow", x: 0.82, y: 0.36, importance: 0.8 },
      { name: "leftWrist", x: 0.08, y: 0.36, importance: 0.6 },
      { name: "rightWrist", x: 0.92, y: 0.48, importance: 0.6 },
      { name: "hips", x: 0.5, y: 0.56, importance: 1 },
      { name: "leftKnee", x: 0.43, y: 0.76, importance: 0.9 },
      { name: "rightKnee", x: 0.6, y: 0.76, importance: 0.9 },
      { name: "leftAnkle", x: 0.38, y: 0.94, importance: 1 },
      { name: "rightAnkle", x: 0.68, y: 0.94, importance: 1 }
    ]
  },
  {
    id: "floor-anchor",
    name: "Floor Anchor",
    difficulty: "spicy",
    joints: [
      { name: "head", x: 0.48, y: 0.14, importance: 0.8 },
      { name: "neck", x: 0.48, y: 0.24, importance: 1 },
      { name: "leftShoulder", x: 0.34, y: 0.28, importance: 1 },
      { name: "rightShoulder", x: 0.62, y: 0.26, importance: 1 },
      { name: "leftElbow", x: 0.22, y: 0.48, importance: 0.8 },
      { name: "rightElbow", x: 0.78, y: 0.22, importance: 0.8 },
      { name: "leftWrist", x: 0.2, y: 0.66, importance: 0.6 },
      { name: "rightWrist", x: 0.9, y: 0.16, importance: 0.6 },
      { name: "hips", x: 0.5, y: 0.58, importance: 1 },
      { name: "leftKnee", x: 0.34, y: 0.8, importance: 0.9 },
      { name: "rightKnee", x: 0.64, y: 0.78, importance: 0.9 },
      { name: "leftAnkle", x: 0.28, y: 0.94, importance: 1 },
      { name: "rightAnkle", x: 0.72, y: 0.94, importance: 1 }
    ]
  }
];
