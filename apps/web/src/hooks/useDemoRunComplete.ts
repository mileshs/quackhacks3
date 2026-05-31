import { useEffect, useRef } from "react";
import { isDemoRunComplete } from "../lib/demoSettings";
import { useEffectiveDevGameplay } from "../lib/settings";
import { useTempo } from "../lib/tempo";

type UseDemoRunCompleteOptions = {
  playing: boolean;
  playingStartedAt: string | null;
  onDemoComplete: () => void;
};

/**
 * Ends the run once the shared tempo cycle reaches the configured demo wall count.
 * Only active when Demo Mode is on (requires Dev Mode).
 */
export function useDemoRunComplete({
  playing,
  playingStartedAt,
  onDemoComplete
}: UseDemoRunCompleteOptions) {
  const { demoMode, demoWallCount } = useEffectiveDevGameplay();
  const tempo = useTempo(playing ? playingStartedAt : null);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onDemoComplete);
  onCompleteRef.current = onDemoComplete;

  useEffect(() => {
    completedRef.current = false;
  }, [playing, playingStartedAt, demoMode, demoWallCount]);

  useEffect(() => {
    if (!playing || !demoMode || !tempo || completedRef.current) {
      return;
    }

    if (isDemoRunComplete(tempo.cycle, demoWallCount)) {
      completedRef.current = true;
      onCompleteRef.current();
    }
  }, [playing, demoMode, demoWallCount, tempo?.cycle, tempo]);
}
