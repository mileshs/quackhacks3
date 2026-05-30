import { useState } from "react";
import { starterPoses } from "@quackhacks/shared";
import { AthleteStage } from "../components/AthleteStage";

export function PoseTestPage() {
  // Until the saboteur feed is wired in, cycle the shared starter poses as test holes.
  const [poseIndex, setPoseIndex] = useState(0);
  const targetPose = starterPoses[poseIndex] ?? starterPoses[0];

  return (
    <AthleteStage
      targetPose={targetPose}
      poseOptions={starterPoses}
      selectedPoseId={targetPose.id}
      onSelectPose={(pose) => {
        const index = starterPoses.findIndex((option) => option.id === pose.id);
        if (index >= 0) {
          setPoseIndex(index);
        }
      }}
    />
  );
}
