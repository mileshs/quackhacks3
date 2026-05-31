import { useState } from "react";
import { starterPoses } from "@quackhacks/shared";
import { AthleteStage } from "../components/AthleteStage";
import { DummySplash } from "../components/DummySplash";

const DUMMY_SPLASH_SEEN_KEY = "quackhacks:dummy:splashSeen";

export function PoseTestPage() {
  // Until the saboteur feed is wired in, cycle the shared starter poses as test holes.
  const [poseIndex, setPoseIndex] = useState(0);
  const [showSplash, setShowSplash] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }
    return window.localStorage.getItem(DUMMY_SPLASH_SEEN_KEY) !== "true";
  });
  const targetPose = starterPoses[poseIndex] ?? starterPoses[0];

  function dismissSplash() {
    setShowSplash(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DUMMY_SPLASH_SEEN_KEY, "true");
    }
  }

  return (
    <>
      {showSplash ? <DummySplash onDismiss={dismissSplash} /> : null}
      <div style={{ position: "absolute", top: "4.5rem", right: "1rem", zIndex: 10 }}>
        <button className="secondary-action" type="button" onClick={() => setShowSplash(true)}>
          Replay Intro
        </button>
      </div>
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
    </>
  );
}
