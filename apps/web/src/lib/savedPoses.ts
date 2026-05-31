import type { UniversalPose } from "@quackhacks/shared";

/** localStorage key the saboteur writes custom poses to and the athlete reads from. */
export const SAVED_POSES_STORAGE_KEY = "quackhacks:saboteur:savedPoses";

/** Read the saboteur's saved poses from localStorage (best-effort, never throws). */
export function loadSavedPoses(): UniversalPose[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(SAVED_POSES_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (pose): pose is UniversalPose =>
        pose && typeof pose === "object" && Array.isArray((pose as UniversalPose).joints)
    );
  } catch {
    return [];
  }
}

/** Persist the saboteur's saved poses to localStorage (best-effort, never throws). */
export function persistSavedPoses(poses: UniversalPose[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(SAVED_POSES_STORAGE_KEY, JSON.stringify(poses));
  } catch {
    // Ignore quota or serialization errors; persistence is best-effort.
  }
}
