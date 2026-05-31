import { GameRole } from "@quackhacks/shared";

export const SOUNDTRACK_ASSETS = {
  mainMenu: "/assets/main_menu_theme.mp3",
  normal: "/assets/soundtrack_normal.mp3",
  speedy: "/assets/soundtrack_speedy.mp3",
} as const;

export const SOUND_EFFECT_ASSETS = {
  boo: "/assets/boo.mp3",
  bruh: "/assets/bruh.mp3",
  buttonClick: "/assets/button_click.mp3",
  cheer: "/assets/cheer.mp3",
  countdown: "/assets/countdown.mp3",
  death: "/assets/death.mp3",
  excellent: "/assets/excellent.mp3",
  gameOver: "/assets/game_over.mp3",
  good: "/assets/good.mp3",
  great: "/assets/great.mp3",
  healthChip: "/assets/health_chip.mp3",
  icicleFreeze: "/assets/icicle_freeze.mp3",
  perfect: "/assets/perfect.mp3",
  skeletonAdjustment1: "/assets/skeleton_adjustment1.mp3",
  skeletonAdjustment2: "/assets/skeleton_adjustment2.mp3",
  skeletonAdjustment3: "/assets/skeleton_adjustment3.mp3",
  skeletonAdjustment4: "/assets/skeleton_adjustment4.mp3",
  skeletonAdjustment5: "/assets/skeleton_adjustment5.mp3",
  wtf: "/assets/wtf.mp3",
} as const;

export type SoundtrackId = keyof typeof SOUNDTRACK_ASSETS;
export type SoundEffectId = keyof typeof SOUND_EFFECT_ASSETS;

/** Soundtracks that repeat until stopped (menu ambience, not gameplay tracks). */
export const LOOPING_SOUNDTRACK_IDS = new Set<SoundtrackId>(["mainMenu"]);

/** Shared game moments — dummy / projector client only. */
export const DUMMY_AUDIENCE_SOUND_EFFECTS = new Set<SoundEffectId>([
  "boo",
  "bruh",
  "cheer",
  "countdown",
  "death",
  "excellent",
  "gameOver",
  "good",
  "great",
  "healthChip",
  "perfect",
  "wtf",
]);

/** Saboteur device only (puppet editing, etc.). */
export const SABOTEUR_LOCAL_SOUND_EFFECTS = new Set<SoundEffectId>([
  "skeletonAdjustment1",
  "skeletonAdjustment2",
  "skeletonAdjustment3",
  "skeletonAdjustment4",
  "skeletonAdjustment5",
]);

export function canPlaySoundEffect(id: SoundEffectId, role: GameRole | null): boolean {
  if (DUMMY_AUDIENCE_SOUND_EFFECTS.has(id)) {
    return role === GameRole.Dummy;
  }

  if (SABOTEUR_LOCAL_SOUND_EFFECTS.has(id)) {
    return role === GameRole.Saboteur;
  }

  return true;
}

// --- Soundtrack tempo map (soundtrack_speedy) ---
// The song starts at 140 BPM and every 16 beats the tempo steps up by 7.5 BPM,
// for 16 segments total, ending with 16 beats at 252.5 BPM.
//
// Because every segment is the same number of beats, the wall-clock length of
// each segment is proportional to 1 / bpm. That lets us map a playback position
// to its BPM using only the song's actual duration (the audio element's
// `.duration`), with no hard-coded beat lengths. To change the tempo curve
// later, edit these constants only.
export const SOUNDTRACK_TEMPO = {
  startBpm: 140,
  bpmStep: 7.5,
  segmentCount: 16,
  beatsPerSegment: 16,
};

export function getSegmentBpms(): number[] {
  return Array.from(
    { length: SOUNDTRACK_TEMPO.segmentCount },
    (_, i) => SOUNDTRACK_TEMPO.startBpm + SOUNDTRACK_TEMPO.bpmStep * i
  );
}

// Relative wall-clock weight of each segment (proportional to 1 / bpm).
function segmentWeights(): number[] {
  return getSegmentBpms().map((bpm) => 1 / bpm);
}

// BPM at a playback position. `totalSeconds` is the song's full duration
// (pass the audio element's `.duration`); segment boundaries are derived from it.
export function getBpmAtTime(seconds: number, totalSeconds: number): number {
  const bpms = getSegmentBpms();

  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return bpms[0];
  }

  const weights = segmentWeights();
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);

  let elapsed = 0;
  for (let i = 0; i < bpms.length; i += 1) {
    const segmentSeconds = totalSeconds * (weights[i] / weightSum);
    if (seconds < elapsed + segmentSeconds) {
      return bpms[i];
    }
    elapsed += segmentSeconds;
  }

  return bpms[bpms.length - 1];
}

// Beat counter (0-based, fractional) at a playback position.
export function getBeatAtTime(seconds: number, totalSeconds: number): number {
  const bpms = getSegmentBpms();

  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return 0;
  }

  const weights = segmentWeights();
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);

  let elapsed = 0;
  let beats = 0;
  for (let i = 0; i < bpms.length; i += 1) {
    const segmentSeconds = totalSeconds * (weights[i] / weightSum);
    if (seconds < elapsed + segmentSeconds) {
      const fraction = (seconds - elapsed) / segmentSeconds;
      return beats + fraction * SOUNDTRACK_TEMPO.beatsPerSegment;
    }
    elapsed += segmentSeconds;
    beats += SOUNDTRACK_TEMPO.beatsPerSegment;
  }

  return beats;
}

export function getTotalSoundtrackBeats(): number {
  return SOUNDTRACK_TEMPO.segmentCount * SOUNDTRACK_TEMPO.beatsPerSegment;
}

export function getSegmentIndexAtBeat(beat: number): number {
  const index = Math.floor(beat / SOUNDTRACK_TEMPO.beatsPerSegment);
  return Math.min(Math.max(0, index), SOUNDTRACK_TEMPO.segmentCount - 1);
}

export function isSoundtrackComplete(beat: number): boolean {
  return beat >= getTotalSoundtrackBeats();
}

/** Inverse of `getBeatAtTime` for seek sync and wall-clock fallback. */
export function getSecondsAtBeat(beat: number, totalSeconds: number): number {
  const totalBeats = getTotalSoundtrackBeats();

  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return 0;
  }

  if (beat <= 0) {
    return 0;
  }

  if (beat >= totalBeats) {
    return totalSeconds;
  }

  const weights = segmentWeights();
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  const segmentIndex = Math.min(
    Math.floor(beat / SOUNDTRACK_TEMPO.beatsPerSegment),
    SOUNDTRACK_TEMPO.segmentCount - 1
  );

  let elapsed = 0;
  for (let i = 0; i < segmentIndex; i += 1) {
    elapsed += totalSeconds * (weights[i] / weightSum);
  }

  const segmentSeconds = totalSeconds * (weights[segmentIndex] / weightSum);
  const beatInSegment = beat - segmentIndex * SOUNDTRACK_TEMPO.beatsPerSegment;
  return elapsed + (beatInSegment / SOUNDTRACK_TEMPO.beatsPerSegment) * segmentSeconds;
}

// preservesPitch is standard but still prefixed in some engines.
function setPreservesPitch(track: HTMLAudioElement, value: boolean): void {
  const el = track as HTMLAudioElement & {
    mozPreservesPitch?: boolean;
    webkitPreservesPitch?: boolean;
  };
  el.preservesPitch = value;
  el.mozPreservesPitch = value;
  el.webkitPreservesPitch = value;
}

/** 1x playback with original pitch (no time-stretch / pitch shift). */
export function applyNeutralSoundtrackPlayback(track: HTMLAudioElement): void {
  track.playbackRate = 1;
  setPreservesPitch(track, true);
}
