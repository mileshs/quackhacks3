import { useCallback } from "react";
import type { GameRole } from "@quackhacks/shared";
import { canPlaySoundEffect, type SoundEffectId } from "../lib/audioEngine";
import { useSound } from "../providers/SoundProvider";

/**
 * Sound API scoped to a game role: dummy-audience SFX only on the dummy client,
 * saboteur-local SFX only on the saboteur client. UI sounds (e.g. buttonClick)
 * still play for every role via unscoped `useSound()`.
 */
export function useRoleScopedSound(role: GameRole | null) {
  const sound = useSound();

  const playSoundEffect = useCallback(
    (id: SoundEffectId) => {
      if (!canPlaySoundEffect(id, role)) {
        return;
      }

      sound.playSoundEffect(id);
    },
    [role, sound]
  );

  const playExclusiveRandomSoundEffect = useCallback(
    (candidates: readonly SoundEffectId[], shouldReplay?: () => boolean) => {
      const allowed = candidates.filter((id) => canPlaySoundEffect(id, role));
      if (allowed.length === 0) {
        return;
      }

      sound.playExclusiveRandomSoundEffect(allowed, shouldReplay);
    },
    [role, sound]
  );

  return {
    ...sound,
    playSoundEffect,
    playExclusiveRandomSoundEffect,
  };
}
