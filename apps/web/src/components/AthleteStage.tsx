import { useCallback, useEffect, useRef, useState } from "react";
import {
  comparePoses,
  holeRadius,
  landmarksToUniversalPose,
  scoreBandFromMatch,
  universalHumanSize,
  universalLimbs,
  type ScoreBand,
  type UniversalPose
} from "@quackhacks/shared";
import {
  DrawingUtils,
  PoseLandmarker,
  getPoseLandmarker,
  startPoseLoop,
  type PoseFrame
} from "../lib/poseTracker";

type AthleteStageProps = {
  /** The hole/wall the athlete is trying to fit into (from the saboteur, or a preset). */
  targetPose: UniversalPose;
};

const STAGE_W = 360;
const STAGE_H = STAGE_W * (universalHumanSize.height / universalHumanSize.width);

const WALL_COLOR = "#10202a";
const HOLE_RIM = "#75e2be";
const DUMMY_LIMB = "#7cdcff";
const DUMMY_JOINT = "#ffd65c";

export function AthleteStage({ targetPose }: AthleteStageProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const camCanvasRef = useRef<HTMLCanvasElement>(null);
  const stageCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopLoopRef = useRef<(() => void) | null>(null);
  const lastMatchUpdate = useRef(0);

  // Keep the latest target in a ref so the running detect loop always sees fresh data
  // without us tearing down and rebuilding the loop on every prop change.
  const targetRef = useRef(targetPose);
  targetRef.current = targetPose;

  const [status, setStatus] = useState("Idle");
  const [running, setRunning] = useState(false);
  const [matchPercent, setMatchPercent] = useState(0);
  const [band, setBand] = useState<ScoreBand>("CRASH");

  const stop = useCallback(() => {
    const wasActive = Boolean(stopLoopRef.current || streamRef.current);
    stopLoopRef.current?.();
    stopLoopRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (wasActive) {
      setRunning(false);
      setStatus("Stopped");
    }
  }, []);

  useEffect(() => stop, [stop]);

  // Redraw the target hole whenever it changes, even while the loop is paused, so the
  // saboteur's edits are visible immediately.
  useEffect(() => {
    const canvas = stageCanvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (ctx) {
      drawStage(ctx, targetPose, null);
    }
  }, [targetPose]);

  async function start() {
    try {
      setStatus("Requesting webcam");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 960 }, height: { ideal: 540 } },
        audio: false
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) {
        return;
      }
      video.srcObject = stream;
      await video.play();

      const camCanvas = camCanvasRef.current;
      if (camCanvas) {
        camCanvas.width = video.videoWidth || 960;
        camCanvas.height = video.videoHeight || 540;
      }

      setStatus("Loading MediaPipe model");
      const landmarker = await getPoseLandmarker();

      const camCtx = camCanvas?.getContext("2d") ?? null;
      const stageCtx = stageCanvasRef.current?.getContext("2d") ?? null;
      const drawingUtils = camCtx ? new DrawingUtils(camCtx) : null;

      setStatus("Tracking");
      setRunning(true);

      stopLoopRef.current = startPoseLoop(video, landmarker, ({ landmarks }) => {
        drawCamera(camCtx, drawingUtils, video, landmarks);

        const aspect = (video.videoWidth || 16) / (video.videoHeight || 9);
        const live = landmarks
          ? landmarksToUniversalPose(landmarks, aspect, { mirror: true })
          : null;

        if (stageCtx) {
          drawStage(stageCtx, targetRef.current, live);
        }

        if (live) {
          const now = performance.now();
          if (now - lastMatchUpdate.current > 120) {
            lastMatchUpdate.current = now;
            const percent = comparePoses(live, targetRef.current);
            setMatchPercent(percent);
            setBand(scoreBandFromMatch(percent));
          }
        }
      });
    } catch (error) {
      setStatus(`Error: ${(error as Error).message}`);
      stop();
    }
  }

  return (
    <div className="athlete-stage">
      <div className="athlete-views">
        <div className="cam-view">
          <video ref={videoRef} muted playsInline className="hidden-video" />
          <canvas ref={camCanvasRef} className="cam-canvas" />
          <span className="view-tag">Camera + skeleton</span>
        </div>
        <div className="hole-view">
          <canvas ref={stageCanvasRef} width={STAGE_W} height={STAGE_H} className="stage-canvas" />
          <span className="view-tag">Hole + universal dummy</span>
        </div>
      </div>
      <div className="tool-panel athlete-controls">
        <h2>Athlete Test</h2>
        <p className="large-status">{status}</p>
        <div className={`match-readout band-${band.toLowerCase()}`}>
          <span className="match-band">{band}</span>
          <span className="match-percent">{matchPercent}%</span>
        </div>
        {running ? (
          <button className="secondary-action" type="button" onClick={stop}>
            Stop
          </button>
        ) : (
          <button className="primary-action" type="button" onClick={start}>
            Start Pose Detection
          </button>
        )}
      </div>
    </div>
  );
}

/** Mirror the webcam frame and overlay MediaPipe's raw skeleton (lines + dots). */
function drawCamera(
  ctx: CanvasRenderingContext2D | null,
  drawingUtils: DrawingUtils | null,
  video: HTMLVideoElement,
  landmarks: PoseFrame["landmarks"]
) {
  if (!ctx) {
    return;
  }
  const { width, height } = ctx.canvas;
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.translate(width, 0);
  ctx.scale(-1, 1); // selfie mirror
  ctx.drawImage(video, 0, 0, width, height);

  if (landmarks && drawingUtils) {
    drawingUtils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, {
      color: "#75e2be",
      lineWidth: 4
    });
    drawingUtils.drawLandmarks(landmarks, { color: "#ffd65c", radius: 4 });
  }
  ctx.restore();
}

/** Draw the wall with the target pose carved out, plus the live universal dummy. */
function drawStage(
  ctx: CanvasRenderingContext2D,
  target: UniversalPose,
  live: UniversalPose | null
) {
  const { width: w, height: h } = ctx.canvas;
  ctx.clearRect(0, 0, w, h);

  const radius = holeRadius(target.difficulty) * w;
  const jointMap = new Map(target.joints.map((j) => [j.name, j]));

  // 1) Wall fill.
  ctx.fillStyle = WALL_COLOR;
  ctx.fillRect(0, 0, w, h);

  // 2) Glowing rim: paint a slightly larger silhouette in the rim color first...
  ctx.save();
  ctx.strokeStyle = HOLE_RIM;
  ctx.fillStyle = HOLE_RIM;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = radius * 2 + 6;
  strokeSilhouette(ctx, universalLimbs, jointMap, w, h);
  fillJoints(ctx, target, w, h, radius + 3);
  ctx.restore();

  // 3) ...then carve the actual hole out of wall + rim (destination-out = transparent).
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.strokeStyle = "#000";
  ctx.fillStyle = "#000";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = radius * 2;
  strokeSilhouette(ctx, universalLimbs, jointMap, w, h);
  fillJoints(ctx, target, w, h, radius);
  ctx.restore();

  // 4) Floor line, matching the preview's "poses are on the floor" rule.
  ctx.strokeStyle = "rgba(255, 214, 92, 0.5)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(w * 0.1, h * 0.96);
  ctx.lineTo(w * 0.9, h * 0.96);
  ctx.stroke();

  // 5) The live universal dummy on top, so the athlete sees themselves in hole-space.
  if (live) {
    drawUniversalSkeleton(ctx, live, w, h);
  }
}

function strokeSilhouette(
  ctx: CanvasRenderingContext2D,
  limbs: typeof universalLimbs,
  jointMap: Map<string, { x: number; y: number }>,
  w: number,
  h: number
) {
  for (const [from, to] of limbs) {
    const a = jointMap.get(from);
    const b = jointMap.get(to);
    if (!a || !b) {
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(a.x * w, a.y * h);
    ctx.lineTo(b.x * w, b.y * h);
    ctx.stroke();
  }
}

function fillJoints(
  ctx: CanvasRenderingContext2D,
  pose: UniversalPose,
  w: number,
  h: number,
  r: number
) {
  for (const joint of pose.joints) {
    ctx.beginPath();
    ctx.arc(joint.x * w, joint.y * h, joint.name === "head" ? r * 1.4 : r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawUniversalSkeleton(
  ctx: CanvasRenderingContext2D,
  pose: UniversalPose,
  w: number,
  h: number
) {
  const jointMap = new Map(pose.joints.map((j) => [j.name, j]));

  ctx.strokeStyle = DUMMY_LIMB;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  for (const [from, to] of universalLimbs) {
    const a = jointMap.get(from);
    const b = jointMap.get(to);
    if (!a || !b) {
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(a.x * w, a.y * h);
    ctx.lineTo(b.x * w, b.y * h);
    ctx.stroke();
  }

  ctx.fillStyle = DUMMY_JOINT;
  for (const joint of pose.joints) {
    ctx.beginPath();
    ctx.arc(joint.x * w, joint.y * h, joint.name === "head" ? 8 : 5, 0, Math.PI * 2);
    ctx.fill();
  }
}
