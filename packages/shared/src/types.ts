export type PlayerRole = "athlete" | "saboteur";

export type JointName =
  | "head"
  | "neck"
  | "leftShoulder"
  | "rightShoulder"
  | "leftElbow"
  | "rightElbow"
  | "leftWrist"
  | "rightWrist"
  | "hips"
  | "leftKnee"
  | "rightKnee"
  | "leftAnkle"
  | "rightAnkle";

export type UniversalJoint = {
  name: JointName;
  x: number;
  y: number;
  importance: number;
};

export type UniversalPose = {
  id: string;
  name: string;
  difficulty: "warmup" | "standard" | "spicy";
  joints: UniversalJoint[];
};

export type RealtimePoseMessage = {
  type: "pose:update";
  pose: UniversalPose;
  sentAt: string;
};
