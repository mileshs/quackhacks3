import { useEffect, useRef, useState } from "react";
import { starterPoses, type UniversalPose } from "@quackhacks/shared";
import { UniversalHumanPreview } from "../components/UniversalHumanPreview";
import { createSocketConnection } from "../lib/realtime";

export function SaboteurPage() {
  const [poseIndex, setPoseIndex] = useState(1);
  const [socketStatus, setSocketStatus] = useState("Socket.IO connecting");
  const socketRef = useRef<ReturnType<typeof createSocketConnection> | null>(null);

  const pose = starterPoses[poseIndex] ?? starterPoses[0];

  useEffect(() => {
    const socket = createSocketConnection();
    socketRef.current = socket;

    socket.on("connect", () => setSocketStatus(`Socket.IO connected: ${socket.id}`));
    socket.on("server:hello", () => setSocketStatus(`Socket.IO ready: ${socket.id}`));
    socket.on("connect_error", () => setSocketStatus("Socket.IO unavailable"));

    return () => {
      socket.disconnect();
    };
  }, []);

  function randomizePose() {
    setPoseIndex((currentIndex) => (currentIndex + 1) % starterPoses.length);
  }

  function broadcastPose(selectedPose: UniversalPose) {
    socketRef.current?.emit("pose:preview", selectedPose);
    setSocketStatus(`Sent ${selectedPose.name}`);
  }

  return (
    <section className="page-grid">
      <div className="page-heading">
        <p className="eyebrow">Saboteur controls</p>
        <h1>Saboteur Screen</h1>
      </div>
      <div className="split-layout">
        <UniversalHumanPreview pose={pose} />
        <div className="tool-panel">
          <h2>Pose Draft</h2>
          <p className="large-status">{pose.name}</p>
          <button className="primary-action" type="button" onClick={randomizePose}>
            Randomize Pose
          </button>
          <button className="secondary-action" type="button" onClick={() => broadcastPose(pose)}>
            Send Temp Pose
          </button>
          <code>{socketStatus}</code>
        </div>
      </div>
    </section>
  );
}
