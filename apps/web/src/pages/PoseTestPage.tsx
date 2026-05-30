import { useState } from "react";
import { starterPoses } from "@quackhacks/shared";
import { AthleteStage } from "../components/AthleteStage";

export function PoseTestPage() {
  // Until the saboteur feed is wired in, cycle the shared starter poses as test holes.
  const [poseIndex, setPoseIndex] = useState(0);
  const targetPose = starterPoses[poseIndex] ?? starterPoses[0];

  return (
    <section className="page-grid">
      <div className="page-heading">
        <p className="eyebrow">Athlete scaffold</p>
        <h1>Pose Test</h1>
      </div>

      <div className="pose-target-bar">
        <span>
          Target hole: <strong>{targetPose.name}</strong> ({targetPose.difficulty})
        </span>
        <div className="pose-target-buttons">
          {starterPoses.map((pose, index) => (
            <button
              key={pose.id}
              type="button"
              className={index === poseIndex ? "primary-action" : "secondary-action"}
              onClick={() => setPoseIndex(index)}
            >
              {pose.name}
            </button>
          ))}
        </div>
      </div>

      <AthleteStage targetPose={targetPose} />
    </section>
  );
}
