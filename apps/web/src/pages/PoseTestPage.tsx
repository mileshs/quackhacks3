import { useEffect, useRef, useState } from "react";

export function PoseTestPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState("Idle");

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function startPoseTest() {
    setStatus("Requesting webcam");

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 960 },
        height: { ideal: 540 }
      },
      audio: false
    });

    streamRef.current = stream;

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }

    setStatus("Loading MediaPipe");
    const mediaPipe = await import("@mediapipe/tasks-vision");
    setStatus(mediaPipe.FilesetResolver ? "Webcam and MediaPipe ready" : "Webcam ready");
  }

  return (
    <section className="page-grid">
      <div className="page-heading">
        <p className="eyebrow">Camera scaffold</p>
        <h1>Pose Test</h1>
      </div>
      <div className="pose-lab">
        <div className="video-frame">
          <video ref={videoRef} muted playsInline />
        </div>
        <div className="tool-panel">
          <h2>MediaPipe Check</h2>
          <p className="large-status">{status}</p>
          <button className="primary-action" type="button" onClick={startPoseTest}>
            Start Pose Detection Test
          </button>
        </div>
      </div>
    </section>
  );
}
