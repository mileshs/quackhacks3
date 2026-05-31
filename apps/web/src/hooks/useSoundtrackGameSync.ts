import { useEffect, useRef } from "react";
import { getBeatAtTime, isSoundtrackComplete } from "../lib/audioEngine";
import { useSound } from "../providers/SoundProvider";

type UseSoundtrackGameSyncOptions = {
  playing: boolean;
  playingStartedAt: string | null;
  /** When true, only demo wall limits end the run (see `useDemoRunComplete`). */
  demoMode?: boolean;
  onSoundtrackComplete: () => void;
};

function seekToAnchor(soundtrack: HTMLAudioElement, playingStartedAt: string) {
  const anchor = Date.parse(playingStartedAt);
  if (!Number.isFinite(anchor) || !Number.isFinite(soundtrack.duration) || soundtrack.duration <= 0) {
    return;
  }

  const elapsed = Math.max(0, (Date.now() - anchor) / 1000);
  soundtrack.currentTime = Math.min(elapsed, soundtrack.duration);
}

/**
 * Starts soundtrack_speedy when play begins, seeks once to the server anchor,
 * and fires once when the track ends or all soundtrack beats are consumed.
 */
export function useSoundtrackGameSync({
  playing,
  playingStartedAt,
  demoMode = false,
  onSoundtrackComplete,
}: UseSoundtrackGameSyncOptions) {
  const { playSoundtrack, stopSoundtrack, getCurrentSoundtrack } = useSound();
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onSoundtrackComplete);
  onCompleteRef.current = onSoundtrackComplete;

  useEffect(() => {
    completedRef.current = false;
  }, [playing, playingStartedAt]);

  useEffect(() => {
    if (!playing) {
      stopSoundtrack();
      return;
    }

    playSoundtrack("speedy");

    const soundtrack = getCurrentSoundtrack();
    if (!soundtrack) {
      return () => stopSoundtrack();
    }

    const maybeComplete = () => {
      if (completedRef.current) {
        return;
      }

      const duration = soundtrack.duration;
      if (!Number.isFinite(duration) || duration <= 0) {
        return;
      }

      if (demoMode) {
        return;
      }

      const beat = getBeatAtTime(soundtrack.currentTime, duration);
      if (soundtrack.ended || isSoundtrackComplete(beat)) {
        completedRef.current = true;
        onCompleteRef.current();
      }
    };

    const onLoadedMetadata = () => {
      if (playingStartedAt) {
        seekToAnchor(soundtrack, playingStartedAt);
      }
    };

    const onEnded = () => {
      if (demoMode || completedRef.current) {
        return;
      }

      completedRef.current = true;
      onCompleteRef.current();
    };

    soundtrack.addEventListener("loadedmetadata", onLoadedMetadata);
    soundtrack.addEventListener("ended", onEnded);

    if (soundtrack.readyState >= 1) {
      onLoadedMetadata();
    }

    const completeIntervalId = window.setInterval(maybeComplete, 100);

    return () => {
      window.clearInterval(completeIntervalId);
      soundtrack.removeEventListener("loadedmetadata", onLoadedMetadata);
      soundtrack.removeEventListener("ended", onEnded);
      stopSoundtrack();
    };
  }, [playing, playingStartedAt, demoMode, playSoundtrack, stopSoundtrack, getCurrentSoundtrack]);
}
