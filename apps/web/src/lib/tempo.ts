import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from "react";
import {
  getBeatAtTime,
  getBpmAtTime,
  getSegmentIndexAtBeat,
  getTotalSoundtrackBeats,
  isSoundtrackComplete,
} from "./audioEngine";
import { useSound } from "../providers/SoundProvider";
import type { SoundtrackId } from "./audioEngine";

/**
 * Shared 8-count tempo aligned to soundtrack_speedy beats. Both role screens derive
 * phase from the same playback position (audio element when playing, else wall-clock
 * from `playingStartedAt`) so saboteur and dummy stay in lockstep.
 *
 * One 8-count cycle = one "wall":
 *   counts 1-4  → rest
 *   counts 5-7  → pose
 *   count  8    → snapshot
 */

export const BEATS_PER_CYCLE = 8;

export type TempoPhase = "rest" | "pose" | "snapshot";

export type TempoState = {
  /** 1-8 within the current cycle. */
  count: number;
  phase: TempoPhase;
  /** Monotonic cycle index since play started; increments every 8 soundtrack beats. */
  cycle: number;
  /** Fractional soundtrack beat (0 .. getTotalSoundtrackBeats()). */
  beat: number;
  bpm: number;
  /** Tempo segment index (0..15); steps every 16 beats. */
  segment: number;
  /** True when the soundtrack has reached the final beat (game over). */
  complete: boolean;
};

export type PlaybackPosition = {
  seconds: number;
  duration: number;
};

export function phaseForCount(count: number): TempoPhase {
  if (count <= 4) {
    return "rest";
  }
  if (count <= 7) {
    return "pose";
  }
  return "snapshot";
}

export function gameTempoFromPlayback(seconds: number, duration: number): TempoState | null {
  if (!Number.isFinite(duration) || duration <= 0) {
    return null;
  }

  const clampedSeconds = Math.max(0, Math.min(seconds, duration));
  const beat = getBeatAtTime(clampedSeconds, duration);
  const bpm = getBpmAtTime(clampedSeconds, duration);
  const beatFloor = Math.floor(beat);
  const count = (beatFloor % BEATS_PER_CYCLE) + 1;

  return {
    count,
    phase: phaseForCount(count),
    cycle: Math.floor(beatFloor / BEATS_PER_CYCLE),
    beat,
    bpm,
    segment: getSegmentIndexAtBeat(beat),
    complete: isSoundtrackComplete(beat),
  };
}

function elapsedSecondsFromAnchor(playingStartedAt: string, now: number): number {
  const anchor = Date.parse(playingStartedAt);
  if (!Number.isFinite(anchor)) {
    return 0;
  }
  return Math.max(0, (now - anchor) / 1000);
}

/** Derive tempo from playback seconds or wall-clock fallback when duration is known. */
export function tempoAt(
  playingStartedAt: string | null | undefined,
  now: number,
  playback: PlaybackPosition | null
): TempoState | null {
  if (!playingStartedAt) {
    return null;
  }

  const duration = playback?.duration ?? 0;
  if (!Number.isFinite(duration) || duration <= 0) {
    return null;
  }

  const seconds =
    playback !== null
      ? Math.max(0, Math.min(playback.seconds, duration))
      : Math.min(elapsedSecondsFromAnchor(playingStartedAt, now), duration);

  return gameTempoFromPlayback(seconds, duration);
}

function readPlaybackFromSoundtrack(getCurrentSoundtrack: () => HTMLAudioElement | null): PlaybackPosition | null {
  const soundtrack = getCurrentSoundtrack();
  if (!soundtrack || soundtrack.paused || !Number.isFinite(soundtrack.duration) || soundtrack.duration <= 0) {
    return null;
  }

  return {
    seconds: soundtrack.currentTime,
    duration: soundtrack.duration,
  };
}

/** Wall-clock position vs server anchor when this client is not playing the soundtrack. */
function readAnchorPlayback(
  playingStartedAt: string,
  now: number,
  getSoundtrackElement: (id: SoundtrackId) => HTMLAudioElement
): PlaybackPosition | null {
  const soundtrack = getSoundtrackElement("speedy");
  const duration = soundtrack.duration;
  if (!Number.isFinite(duration) || duration <= 0) {
    return null;
  }

  return {
    seconds: Math.min(elapsedSecondsFromAnchor(playingStartedAt, now), duration),
    duration,
  };
}

function resolvePlayback(
  playingStartedAt: string,
  now: number,
  getCurrentSoundtrack: () => HTMLAudioElement | null,
  getSoundtrackElement: (id: SoundtrackId) => HTMLAudioElement
): PlaybackPosition | null {
  return (
    readPlaybackFromSoundtrack(getCurrentSoundtrack) ??
    readAnchorPlayback(playingStartedAt, now, getSoundtrackElement)
  );
}

/**
 * Live game tempo from soundtrack_speedy playback (preferred) or wall-clock vs anchor.
 */
const GameTempoContext = createContext<TempoState | null>(null);

export function GameTempoProvider({
  playingStartedAt,
  children,
}: {
  playingStartedAt: string | null;
  children: ReactNode;
}) {
  const tempo = useTempo(playingStartedAt);
  return createElement(GameTempoContext.Provider, { value: tempo }, children);
}

/** Tempo from the nearest `GameTempoProvider` (role game shell). */
export function useGameTempo(): TempoState | null {
  return useContext(GameTempoContext);
}

export function useTempo(playingStartedAt: string | null | undefined): TempoState | null {
  const { getCurrentSoundtrack, getSoundtrackElement, activeSoundtrackId } = useSound();
  const [state, setState] = useState<TempoState | null>(() => {
    if (!playingStartedAt) {
      return null;
    }
    const playback = resolvePlayback(playingStartedAt, Date.now(), getCurrentSoundtrack, getSoundtrackElement);
    return tempoAt(playingStartedAt, Date.now(), playback);
  });

  useEffect(() => {
    if (!playingStartedAt) {
      setState(null);
      return;
    }

    const speedy = getSoundtrackElement("speedy");
    const onMetadata = () => {
      setState(tempoAt(playingStartedAt, Date.now(), resolvePlayback(playingStartedAt, Date.now(), getCurrentSoundtrack, getSoundtrackElement)));
    };

    if (speedy.readyState < 1) {
      speedy.addEventListener("loadedmetadata", onMetadata);
      speedy.load();
    }

    const tick = () => {
      const playback = resolvePlayback(playingStartedAt, Date.now(), getCurrentSoundtrack, getSoundtrackElement);
      setState(tempoAt(playingStartedAt, Date.now(), playback));
    };

    tick();
    const id = window.setInterval(tick, 50);
    return () => {
      window.clearInterval(id);
      speedy.removeEventListener("loadedmetadata", onMetadata);
    };
  }, [playingStartedAt, getCurrentSoundtrack, getSoundtrackElement, activeSoundtrackId]);

  return state;
}

export { getTotalSoundtrackBeats };
