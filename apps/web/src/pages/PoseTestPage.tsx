import { useCallback, useEffect, useMemo, useState } from "react";
import { GameRole, starterPoses, type UniversalPose } from "@quackhacks/shared";
import { AthleteStage } from "../components/AthleteStage";
import { DummySplash } from "../components/DummySplash";
import { GameTempoBridge } from "../components/GameTempoBridge";
import { RoleGameShell } from "../components/RoleGameShell";
import { loadSavedPoses } from "../lib/savedPoses";
import type { TempoState } from "../lib/tempo";
import { secondaryAction } from "../lib/ui";
import { useActiveGame } from "../lib/useActiveGame";

export function PoseTestPage() {
  const [savedPoses, setSavedPoses] = useState<UniversalPose[]>(loadSavedPoses);
  const [previewPose, setPreviewPose] = useState<UniversalPose | null>(null);
  const [selectedId, setSelectedId] = useState(starterPoses[0]?.id ?? "");
  const gameControls = useActiveGame();
  const { lastPose, lastPowerup, sendRoundSnapshot } = gameControls;
  const [tempo, setTempo] = useState<TempoState | null>(null);
  const [showSplash, setShowSplash] = useState(true);

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
  const savedPoseIds = useMemo(() => savedPoses.map((pose) => pose.id), [savedPoses]);
  const targetPose = previewPose ?? poseOptions.find((pose) => pose.id === selectedId) ?? poseOptions[0] ?? starterPoses[0];
  const handleSelectPose = useCallback((pose: UniversalPose) => setSelectedId(pose.id), []);

  const dismissSplash = useCallback(() => {
    setShowSplash(false);
  }, []);

  const showIntro = useCallback(() => setShowSplash(true), []);

  return (
    <>
      {showSplash ? <DummySplash onDismiss={dismissSplash} /> : null}
      <RoleGameShell role={GameRole.Dummy} controls={gameControls}>
        <GameTempoBridge onTempo={setTempo} />
        <div className="absolute top-18 right-4 z-10">
          <button className={secondaryAction} type="button" onClick={showIntro}>
            Replay Intro
          </button>
        </div>
        <AthleteStage
          targetPose={targetPose}
          poseOptions={poseOptions}
          savedPoseIds={savedPoseIds}
          selectedPoseId={targetPose.id}
          onSelectPose={handleSelectPose}
          powerupActivation={lastPowerup}
          onFinishWall={sendRoundSnapshot}
          tempo={tempo}
        />
      </RoleGameShell>
    </>
  );
}
