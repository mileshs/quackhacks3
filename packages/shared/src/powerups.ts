import type { ScoreBand } from "./scoring.js";

export type SaboteurPowerupKind = "blindness" | "mirror";

export type SaboteurPowerupDefinition = {
  kind: SaboteurPowerupKind;
  name: string;
  description: string;
};

export const SABOTEUR_POWERUP_DEFINITIONS: Record<SaboteurPowerupKind, SaboteurPowerupDefinition> = {
  blindness: {
    kind: "blindness",
    name: "Blindness",
    description: "Black out the poser's view except for a small spotlight on their body."
  },
  mirror: {
    kind: "mirror",
    name: "Mirror Mode",
    description: "Flip the poser's camera view horizontally."
  }
};

export const SABOTEUR_MAX_POWERUP_INVENTORY = 2;
export const SABOTEUR_PERFECTS_PER_POWERUP = 3;
export const SABOTEUR_MOVES_PER_POWERUP = 10;
export const DEFAULT_POWERUP_DURATION_MS = 8_000;

export type SaboteurPowerupSlot = {
  id: string;
  kind: SaboteurPowerupKind;
};

export type RoundSnapshotPayload = {
  matchPercent: number;
  band: ScoreBand;
  sentAt: string;
};

export type PowerupActivatePayload = {
  kind: SaboteurPowerupKind;
  durationMs?: number;
  sentAt: string;
};

export type SaboteurPowerupProgress = {
  inventory: SaboteurPowerupSlot[];
  perfectStreak: number;
  movesSinceGrant: number;
};

export function pickRandomSaboteurPowerup(): SaboteurPowerupKind {
  const kinds: SaboteurPowerupKind[] = ["blindness", "mirror"];
  return kinds[Math.floor(Math.random() * kinds.length)]!;
}

export function createSaboteurPowerupSlot(kind: SaboteurPowerupKind): SaboteurPowerupSlot {
  return { id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, kind };
}

function tryGrantPowerups(progress: SaboteurPowerupProgress): SaboteurPowerupProgress {
  let inventory = [...progress.inventory];
  let perfectStreak = progress.perfectStreak;
  let movesSinceGrant = progress.movesSinceGrant;

  while (
    inventory.length < SABOTEUR_MAX_POWERUP_INVENTORY &&
    (perfectStreak >= SABOTEUR_PERFECTS_PER_POWERUP || movesSinceGrant >= SABOTEUR_MOVES_PER_POWERUP)
  ) {
    inventory = [...inventory, createSaboteurPowerupSlot(pickRandomSaboteurPowerup())];
    perfectStreak = 0;
    movesSinceGrant = 0;
  }

  return { inventory, perfectStreak, movesSinceGrant };
}

/** Athlete finished a wall — update streak / move count and maybe grant a card. */
export function applyRoundSnapshot(
  progress: SaboteurPowerupProgress,
  band: ScoreBand
): SaboteurPowerupProgress {
  const movesSinceGrant = progress.movesSinceGrant + 1;
  const perfectStreak = band === "PERFECT" ? progress.perfectStreak + 1 : 0;

  return tryGrantPowerups({ ...progress, movesSinceGrant, perfectStreak });
}

/** Saboteur picked a random pose — counts toward the move threshold. */
export function registerSaboteurMove(progress: SaboteurPowerupProgress): SaboteurPowerupProgress {
  return tryGrantPowerups({
    ...progress,
    movesSinceGrant: progress.movesSinceGrant + 1
  });
}
