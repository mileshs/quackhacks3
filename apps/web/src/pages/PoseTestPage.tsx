import { useEffect, useMemo, useState } from "react";
import { starterPoses, type UniversalPose } from "@quackhacks/shared";
import { AthleteStage } from "../components/AthleteStage";
import { loadSavedPoses } from "../lib/savedPoses";

export function PoseTestPage() {
  // Poses the saboteur saved (localStorage). Refreshed whenever the tab regains focus
  // or another tab writes new poses, so saving on the saboteur page then coming here
  // shows the latest holes without a reload.
  const [savedPoses, setSavedPoses] = useState<UniversalPose[]>(loadSavedPoses);

  useEffect(() => {
    const refresh = () => setSavedPoses(loadSavedPoses());
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const poseOptions = useMemo(() => [...starterPoses, ...savedPoses], [savedPoses]);

  const [selectedId, setSelectedId] = useState(starterPoses[0]?.id ?? "");
  const targetPose =
    poseOptions.find((pose) => pose.id === selectedId) ?? poseOptions[0] ?? starterPoses[0];

  return (
    <AthleteStage
      targetPose={targetPose}
      poseOptions={poseOptions}
      savedPoseIds={savedPoses.map((pose) => pose.id)}
      selectedPoseId={targetPose.id}
      onSelectPose={(pose) => setSelectedId(pose.id)}
    />
  );
}
