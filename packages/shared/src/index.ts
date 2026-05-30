// Shared types used by both the client and the server.

/** A single leaderboard entry persisted in sqlite. */
export interface LeaderboardEntry {
  id: number;
  name: string;
  /** Total accumulated score while playing as the athlete. */
  score: number;
  /** Survival time in seconds. */
  survivalTime: number;
  createdAt: string;
}

/** Payload to submit a new score to the leaderboard. */
export interface SubmitScore {
  name: string;
  score: number;
  survivalTime: number;
}

/** Realtime socket.io event names exchanged between saboteur and poser. */
export const SocketEvents = {
  /** Saboteur pushes updated dummy joint angles to the poser. */
  PoseUpdate: "pose:update",
  /** Poser reports a completed wall's match percentage. */
  WallScored: "wall:scored",
  /** A client joins a game room. */
  JoinRoom: "room:join",
} as const;

export type SocketEvent = (typeof SocketEvents)[keyof typeof SocketEvents];

/** A normalized pose: joint angles applied to the universal-human dummy. */
export interface PoseFrame {
  /** Map of joint name -> rotational angle in degrees. */
  angles: Record<string, number>;
  /** Difficulty hint controlling carved-hole radius. */
  difficulty?: "easy" | "medium" | "hard";
}
