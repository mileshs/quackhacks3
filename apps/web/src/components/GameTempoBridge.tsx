import { useEffect } from "react";
import { type TempoState, useGameTempo } from "../lib/tempo";

type GameTempoBridgeProps = {
  onTempo: (tempo: TempoState | null) => void;
};

export function GameTempoBridge({ onTempo }: GameTempoBridgeProps) {
  const tempo = useGameTempo();

  useEffect(() => {
    onTempo(tempo);
  }, [onTempo, tempo]);

  return null;
}
