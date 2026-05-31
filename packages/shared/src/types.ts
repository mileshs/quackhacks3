import type { PowerupActivatePayload, RoundSnapshotPayload } from "./powerups.js";

export enum GameRole {
  Dummy = "dummy",
  Saboteur = "saboteur"
}

export type RoleClaimStatus = "empty" | "occupied";

export type RoleClaim = {
  status: RoleClaimStatus;
  lastSeenAt: string | null;
};

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

export type ActiveGameState = {
  activeGame: boolean;
  gameId: string | null;
  startedAt: string | null;
  endedAt: string | null;
  endReason: "manual" | "role-disconnected" | "role-timeout" | null;
  updatedAt: string;
  playerCount: number;
  roles: Record<GameRole, RoleClaim>;
};

export type GameClientMessage =
  | { type: "game:start" }
  | { type: "game:end" }
  | { type: "role:claim"; role: GameRole }
  | { type: "role:heartbeat"; role: GameRole }
  | { type: "pose:update"; pose: UniversalPose }
  | { type: "round:snapshot"; payload: RoundSnapshotPayload }
  | { type: "powerup:activate"; payload: PowerupActivatePayload };

export type GameServerMessage =
  | { type: "game:state"; state: ActiveGameState }
  | { type: "role:accepted"; role: GameRole }
  | { type: "role:rejected"; role: GameRole; reason: "taken" | "inactive-game" | "invalid-role" }
  | { type: "round:snapshot"; payload: RoundSnapshotPayload; sentAt: string }
  | { type: "powerup:activate"; payload: PowerupActivatePayload; sentAt: string }
  | { type: "error"; error: string };
