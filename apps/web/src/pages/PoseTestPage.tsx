import { useEffect, useMemo, useState } from "react";
import { GameRole, starterPoses, type UniversalPose } from "@quackhacks/shared";
import { AthleteStage } from "../components/AthleteStage";
import { DummySplash } from "../components/DummySplash";
import { RoleGameShell } from "../components/RoleGameShell";
import { loadSavedPoses } from "../lib/savedPoses";
import { useTempo } from "../lib/tempo";
import { secondaryAction } from "../lib/ui";
import { useActiveGame } from "../lib/useActiveGame";

const DUMMY_SPLASH_SEEN_KEY = "quackhacks:dummy:splashSeen";

export function PoseTestPage() {
  const [savedPoses, setSavedPoses] = useState<UniversalPose[]>(loadSavedPoses);
  const [previewPose, setPreviewPose] = useState<UniversalPose | null>(null);
  const [selectedId, setSelectedId] = useState(starterPoses[0]?.id ?? "");
  const gameControls = useActiveGame();
  const { game, lastPose, lastPowerup, sendRoundSnapshot } = gameControls;
  const tempo = useTempo(game?.playingStartedAt ?? null);
  const [showSplash, setShowSplash] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }
    return window.localStorage.getItem(DUMMY_SPLASH_SEEN_KEY) !== "true";
  });

  useEffect(() => {
    const refresh = () => setSavedPoses(loadSavedPoses());
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    if (lastPose?.joints) {
      setPreviewPose(lastPose);
      setSelectedId(lastPose.id);
    }
  }, [lastPose]);

  const poseOptions = useMemo(() => {
    const base = [...starterPoses, ...savedPoses];
    if (previewPose && !base.some((pose) => pose.id === previewPose.id)) {
      return [...base, previewPose];
    }
    return base;
  }, [savedPoses, previewPose]);
  const targetPose = previewPose ?? poseOptions.find((pose) => pose.id === selectedId) ?? poseOptions[0] ?? starterPoses[0];

  function dismissSplash() {
    setShowSplash(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DUMMY_SPLASH_SEEN_KEY, "true");
    }
  }

  return (
    <RoleGameShell role={GameRole.Dummy} controls={gameControls}>
      {showSplash ? <DummySplash onDismiss={dismissSplash} /> : null}
      <div className="absolute top-18 right-4 z-10">
        <button className={secondaryAction} type="button" onClick={() => setShowSplash(true)}>
          Replay Intro
        </button>
      </div>
      <AthleteStage
        targetPose={targetPose}
        poseOptions={poseOptions}
        savedPoseIds={savedPoses.map((pose) => pose.id)}
        selectedPoseId={targetPose.id}
        onSelectPose={(pose) => setSelectedId(pose.id)}
        powerupActivation={lastPowerup}
        onFinishWall={sendRoundSnapshot}
        tempo={tempo}
      />
    </RoleGameShell>
  );
}
