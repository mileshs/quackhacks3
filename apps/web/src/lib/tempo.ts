import { useEffect, useState } from "react";

/**
 * The shared 8-count tempo. Both the dummy and saboteur screens derive the same beat from
 * a single shared anchor (`game.playingStartedAt`, stamped by the server when play begins),
 * so they stay in lockstep without any per-beat network traffic.
 *
 * One 8-count cycle = one "wall":
 *   counts 1-4  → rest      (dummy dimmed, "wait for the saboteur")
 *   counts 5-7  → pose      (reveal the queued pose, dummy moves to match)
 *   count  8    → snapshot  (freeze + flash + record the score)
 */

// Deliberately slow first pass (~55 BPM). Tune this one constant to change the speed.
export const BEAT_MS = 1100;
export const BEATS_PER_CYCLE = 8;

export type TempoPhase = "rest" | "pose" | "snapshot";
export type TempoState = {
  /** 1-8 within the current cycle. */
  count: number;
  phase: TempoPhase;
  /** Monotonic cycle index since play started; increments every 8 counts. */
  cycle: number;
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

/** Pure beat derivation from the shared anchor; returns null when there's no anchor. */
export function tempoAt(playingStartedAt: string | null | undefined, now: number): TempoState | null {
  if (!playingStartedAt) {
    return null;
  }
  const anchor = Date.parse(playingStartedAt);
  if (!Number.isFinite(anchor)) {
    return null;
  }
  const elapsed = Math.max(0, now - anchor);
  const beat = Math.floor(elapsed / BEAT_MS);
  const count = (beat % BEATS_PER_CYCLE) + 1;
  const cycle = Math.floor(beat / BEATS_PER_CYCLE);
  return { count, phase: phaseForCount(count), cycle };
}

/** Live tempo state, re-derived ~10x/sec from the shared anchor. */
export function useTempo(playingStartedAt: string | null | undefined): TempoState | null {
  const [state, setState] = useState<TempoState | null>(() => tempoAt(playingStartedAt, Date.now()));

  useEffect(() => {
    if (!playingStartedAt) {
      setState(null);
      return;
    }
    const tick = () => setState(tempoAt(playingStartedAt, Date.now()));
    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [playingStartedAt]);

  return state;
}
