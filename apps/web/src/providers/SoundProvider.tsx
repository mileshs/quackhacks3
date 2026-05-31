import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  applyNeutralSoundtrackPlayback,
  getBeatAtTime,
  getBpmAtTime,
  LOOPING_SOUNDTRACK_IDS,
  SOUND_EFFECT_ASSETS,
  SOUNDTRACK_ASSETS,
  startTimeWarp,
  type SoundEffectId,
  type SoundtrackId,
} from "../lib/audioEngine";

const legacyVolumeStorageKey = "quackhacks.volume";
const soundtrackVolumeStorageKey = "poses.soundtrackVolume";
const soundEffectsVolumeStorageKey = "poses.soundEffectsVolume";

export const SKELETON_ADJUSTMENT_SOUNDS = [
  "skeletonAdjustment1",
  "skeletonAdjustment2",
  "skeletonAdjustment3",
  "skeletonAdjustment4",
  "skeletonAdjustment5",
] as const satisfies readonly SoundEffectId[];

type TempoState = {
  beat: number;
  bpm: number;
};

type SoundContextValue = {
  soundtrackVolume: number;
  soundEffectsVolume: number;
  tempo: TempoState;
  activeSoundtrackId: SoundtrackId | null;
  setSoundtrackVolume: (volume: number) => void;
  setSoundEffectsVolume: (volume: number) => void;
  playSoundEffect: (id: SoundEffectId) => void;
  playExclusiveRandomSoundEffect: (candidates: readonly SoundEffectId[], shouldReplay?: () => boolean) => void;
  stopExclusiveSoundEffect: () => void;
  playSoundtrack: (id: SoundtrackId) => void;
  stopSoundtrack: () => void;
  triggerTimeWarp: () => void;
  getCurrentSoundtrack: () => HTMLAudioElement | null;
  /** Cached soundtrack element (may not be playing); used for tempo metadata on non-dummy screens. */
  getSoundtrackElement: (id: SoundtrackId) => HTMLAudioElement;
};

const SoundContext = createContext<SoundContextValue | null>(null);

function parseStoredVolume(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    return null;
  }

  return parsed;
}

function readInitialVolume(storageKey: string): number {
  const savedVolume = parseStoredVolume(window.localStorage.getItem(storageKey));
  if (savedVolume !== null) {
    return savedVolume;
  }

  return parseStoredVolume(window.localStorage.getItem(legacyVolumeStorageKey)) ?? 70;
}

function clampVolume(volume: number): number {
  return Math.max(0, Math.min(100, volume));
}

export function SoundProvider({ children }: { children: ReactNode }) {
  const soundtrackRefs = useRef<Partial<Record<SoundtrackId, HTMLAudioElement>>>({});
  const soundEffectRefs = useRef<Partial<Record<SoundEffectId, HTMLAudioElement>>>({});
  const exclusiveSfxRef = useRef<HTMLAudioElement | null>(null);
  const exclusiveSfxEndedHandlerRef = useRef<(() => void) | null>(null);
  const timeWarpCancelRef = useRef<(() => void) | null>(null);

  const [soundtrackVolume, setSoundtrackVolumeState] = useState(() => readInitialVolume(soundtrackVolumeStorageKey));
  const [soundEffectsVolume, setSoundEffectsVolumeState] = useState(() => readInitialVolume(soundEffectsVolumeStorageKey));
  const [activeSoundtrackId, setActiveSoundtrackId] = useState<SoundtrackId | null>(null);
  const [tempo, setTempo] = useState<TempoState>({ beat: 0, bpm: 0 });

  const getSoundtrack = useCallback(
    (id: SoundtrackId) => {
      soundtrackRefs.current[id] ??= new Audio(SOUNDTRACK_ASSETS[id]);
      applyNeutralSoundtrackPlayback(soundtrackRefs.current[id]);
      soundtrackRefs.current[id].volume = soundtrackVolume / 100;
      return soundtrackRefs.current[id];
    },
    [soundtrackVolume]
  );

  const getSoundEffect = useCallback(
    (id: SoundEffectId) => {
      soundEffectRefs.current[id] ??= new Audio(SOUND_EFFECT_ASSETS[id]);
      soundEffectRefs.current[id].volume = soundEffectsVolume / 100;
      return soundEffectRefs.current[id];
    },
    [soundEffectsVolume]
  );

  const setSoundtrackVolume = useCallback((nextVolume: number) => {
    const clampedVolume = clampVolume(nextVolume);
    setSoundtrackVolumeState(clampedVolume);
    window.localStorage.setItem(soundtrackVolumeStorageKey, String(clampedVolume));
  }, []);

  const setSoundEffectsVolume = useCallback((nextVolume: number) => {
    const clampedVolume = clampVolume(nextVolume);
    setSoundEffectsVolumeState(clampedVolume);
    window.localStorage.setItem(soundEffectsVolumeStorageKey, String(clampedVolume));
  }, []);

  const getCurrentSoundtrack = useCallback(() => {
    return activeSoundtrackId ? soundtrackRefs.current[activeSoundtrackId] ?? null : null;
  }, [activeSoundtrackId]);

  const stopSoundtrack = useCallback(() => {
    timeWarpCancelRef.current?.();
    timeWarpCancelRef.current = null;

    for (const soundtrack of Object.values(soundtrackRefs.current)) {
      soundtrack?.pause();
      if (soundtrack) {
        soundtrack.currentTime = 0;
        soundtrack.loop = false;
        applyNeutralSoundtrackPlayback(soundtrack);
      }
    }

    setActiveSoundtrackId(null);
    setTempo({ beat: 0, bpm: 0 });
  }, []);

  const playSoundtrack = useCallback(
    (id: SoundtrackId) => {
      timeWarpCancelRef.current?.();
      timeWarpCancelRef.current = null;

      for (const [soundtrackId, soundtrack] of Object.entries(soundtrackRefs.current)) {
        if (soundtrackId !== id) {
          soundtrack?.pause();
        }
      }

      const soundtrack = getSoundtrack(id);
      soundtrack.loop = LOOPING_SOUNDTRACK_IDS.has(id);
      soundtrack.currentTime = 0;
      applyNeutralSoundtrackPlayback(soundtrack);
      soundtrack.play().catch((err) => {
        console.warn("Soundtrack playback blocked or failed:", err);
      });
      setActiveSoundtrackId(id);
    },
    [getSoundtrack]
  );

  const playSoundEffect = useCallback(
    (id: SoundEffectId) => {
      const soundEffect = getSoundEffect(id);
      soundEffect.currentTime = 0;
      soundEffect.play().catch((err) => {
        console.warn("Sound effect playback blocked or failed:", err);
      });
    },
    [getSoundEffect]
  );

  const stopExclusiveSoundEffect = useCallback(() => {
    const soundEffect = exclusiveSfxRef.current;
    if (!soundEffect) {
      return;
    }

    if (exclusiveSfxEndedHandlerRef.current) {
      soundEffect.removeEventListener("ended", exclusiveSfxEndedHandlerRef.current);
      exclusiveSfxEndedHandlerRef.current = null;
    }

    soundEffect.pause();
    soundEffect.currentTime = 0;
    exclusiveSfxRef.current = null;
  }, []);

  const playExclusiveRandomSoundEffect = useCallback(
    (candidates: readonly SoundEffectId[], shouldReplay?: () => boolean) => {
      if (candidates.length === 0) {
        return;
      }

      const current = exclusiveSfxRef.current;
      if (current && !current.paused && !current.ended) {
        return;
      }

      const id = candidates[Math.floor(Math.random() * candidates.length)];
      const soundEffect = getSoundEffect(id);
      exclusiveSfxRef.current = soundEffect;

      const onEnded = () => {
        soundEffect.removeEventListener("ended", onEnded);
        exclusiveSfxEndedHandlerRef.current = null;
        if (exclusiveSfxRef.current === soundEffect) {
          exclusiveSfxRef.current = null;
        }

        if (shouldReplay?.()) {
          queueMicrotask(() => {
            playExclusiveRandomSoundEffect(candidates, shouldReplay);
          });
        }
      };

      exclusiveSfxEndedHandlerRef.current = onEnded;
      soundEffect.addEventListener("ended", onEnded);
      soundEffect.currentTime = 0;
      soundEffect.play().catch((err) => {
        console.warn("Sound effect playback blocked or failed:", err);
        onEnded();
      });
    },
    [getSoundEffect]
  );

  const triggerTimeWarp = useCallback(() => {
    timeWarpCancelRef.current?.();
    timeWarpCancelRef.current = null;

    const soundtrack = getCurrentSoundtrack();
    if (!soundtrack) {
      return;
    }

    timeWarpCancelRef.current = startTimeWarp(soundtrack, getSoundEffect("timeWarp"), {
      masterVolume: soundEffectsVolume / 100,
    });
  }, [getCurrentSoundtrack, getSoundEffect, soundEffectsVolume]);

  useEffect(() => {
    for (const soundtrack of Object.values(soundtrackRefs.current)) {
      if (soundtrack) {
        soundtrack.volume = soundtrackVolume / 100;
      }
    }
  }, [soundtrackVolume]);

  useEffect(() => {
    for (const soundEffect of Object.values(soundEffectRefs.current)) {
      if (soundEffect) {
        soundEffect.volume = soundEffectsVolume / 100;
      }
    }
  }, [soundEffectsVolume]);

  useEffect(() => {
    function playButtonClickFromTarget(target: EventTarget | null) {
      if (!(target instanceof Element)) {
        return;
      }

      const button = target.closest("button");
      if (button) {
        if (!button.disabled && !button.hasAttribute("data-no-click-sound")) {
          playSoundEffect("buttonClick");
        }
        return;
      }

      const anchor = target.closest("a[href]");
      if (anchor && !anchor.hasAttribute("data-no-click-sound")) {
        playSoundEffect("buttonClick");
      }
    }

    const onDocumentPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }

      playButtonClickFromTarget(event.target);
    };

    const onDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || (event.key !== "Enter" && event.key !== " ")) {
        return;
      }

      playButtonClickFromTarget(event.target);
    };

    document.addEventListener("pointerdown", onDocumentPointerDown, true);
    document.addEventListener("keydown", onDocumentKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onDocumentPointerDown, true);
      document.removeEventListener("keydown", onDocumentKeyDown, true);
    };
  }, [playSoundEffect]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const soundtrack = activeSoundtrackId ? soundtrackRefs.current[activeSoundtrackId] : null;
      if (!soundtrack) {
        return;
      }

      setTempo({
        beat: Math.floor(getBeatAtTime(soundtrack.currentTime, soundtrack.duration)),
        bpm: getBpmAtTime(soundtrack.currentTime, soundtrack.duration),
      });
    }, 100);

    return () => window.clearInterval(intervalId);
  }, [activeSoundtrackId]);

  useEffect(() => {
    return () => {
      timeWarpCancelRef.current?.();

      for (const soundtrack of Object.values(soundtrackRefs.current)) {
        soundtrack?.pause();
      }

      for (const soundEffect of Object.values(soundEffectRefs.current)) {
        soundEffect?.pause();
      }
    };
  }, []);

  const value = useMemo<SoundContextValue>(
    () => ({
      soundtrackVolume,
      soundEffectsVolume,
      tempo,
      activeSoundtrackId,
      setSoundtrackVolume,
      setSoundEffectsVolume,
      playSoundEffect,
      playExclusiveRandomSoundEffect,
      stopExclusiveSoundEffect,
      playSoundtrack,
      stopSoundtrack,
      triggerTimeWarp,
      getCurrentSoundtrack,
      getSoundtrackElement: getSoundtrack,
    }),
    [
      soundtrackVolume,
      soundEffectsVolume,
      tempo,
      activeSoundtrackId,
      setSoundtrackVolume,
      setSoundEffectsVolume,
      playSoundEffect,
      playExclusiveRandomSoundEffect,
      stopExclusiveSoundEffect,
      playSoundtrack,
      stopSoundtrack,
      triggerTimeWarp,
      getCurrentSoundtrack,
      getSoundtrack,
    ]
  );

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export function useSound() {
  const context = useContext(SoundContext);
  if (!context) {
    throw new Error("useSound must be used within a SoundProvider");
  }

  return context;
}
