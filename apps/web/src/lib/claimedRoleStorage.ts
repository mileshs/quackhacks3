import { GameRole } from "@quackhacks/shared";

const CLAIMED_ROLE_STORAGE_KEY = "poses.claimedRole";

export function readPersistedClaimedRole(): GameRole | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.sessionStorage.getItem(CLAIMED_ROLE_STORAGE_KEY);
  if (value === GameRole.Dummy || value === GameRole.Saboteur) {
    return value;
  }

  return null;
}

export function writePersistedClaimedRole(role: GameRole): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(CLAIMED_ROLE_STORAGE_KEY, role);
}

export function clearPersistedClaimedRole(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(CLAIMED_ROLE_STORAGE_KEY);
}
