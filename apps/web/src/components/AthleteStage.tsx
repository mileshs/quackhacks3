import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
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
  /** Optional test poses shown as a selector in the sidebar (omit for the real game). */
  poseOptions?: UniversalPose[];
  selectedPoseId?: string;
  onSelectPose?: (pose: UniversalPose) => void;
};

// The hole keeps a human portrait shape (not stretched to the camera's aspect): a
// centered "doorway" whose height fills the frame.
const HOLE_ASPECT = universalHumanSize.width / universalHumanSize.height;

// Everything OUTSIDE the hole is a semi-transparent tinted wall; the hole itself is
// punched clear so the live camera shows through it.
const WALL_TINT = "rgba(6, 14, 20, 0.66)";
const HOLE_EDGE = "rgba(160, 247, 214, 0.7)";
// Backdrop used for the idle preview, chosen lighter than the tinted wall so the
// cut-out hole is visible before the camera starts.
const IDLE_BACKDROP = "#14262f";

// Reusable offscreen canvas: we paint the wall there and carve the hole out of it,
// then composite over the camera so the carve never erases the camera pixels.
let wallCanvas: HTMLCanvasElement | null = null;
function getWallCtx(width: number, height: number): CanvasRenderingContext2D {
  if (!wallCanvas) {
    wallCanvas = document.createElement("canvas");
  }
  if (wallCanvas.width !== width) {
    wallCanvas.width = width;
  }
  if (wallCanvas.height !== height) {
    wallCanvas.height = height;
  }
  const ctx = wallCanvas.getContext("2d")!;
  ctx.clearRect(0, 0, width, height);
  return ctx;
}

export function AthleteStage({
  targetPose,
  poseOptions,
  selectedPoseId,
  onSelectPose
}: AthleteStageProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  // Preview the target hole on a black backdrop whenever it changes while paused, so
  // the saboteur's edits are visible before the camera is even running.
  useEffect(() => {
    if (running) {
      return;
    }
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      return;
    }
    ctx.fillStyle = IDLE_BACKDROP;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawHoleOverlay(ctx, targetPose, canvas.width, canvas.height);
  }, [targetPose, running]);

  async function start() {
    try {
      setStatus("Requesting webcam");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) {
        return;
      }
      video.srcObject = stream;
      await video.play();

      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
      }

      setStatus("Loading MediaPipe model");
      const landmarker = await getPoseLandmarker();

      const ctx = canvas?.getContext("2d") ?? null;
      const drawingUtils = ctx ? new DrawingUtils(ctx) : null;

      setStatus("Tracking");
      setRunning(true);
      setSidebarOpen(false);

      stopLoopRef.current = startPoseLoop(video, landmarker, ({ landmarks }) => {
        if (ctx) {
          drawFrame(ctx, drawingUtils, video, landmarks, targetRef.current);
        }

        if (landmarks) {
          const aspect = (video.videoWidth || 16) / (video.videoHeight || 9);
          const live = landmarksToUniversalPose(landmarks, aspect, { mirror: true });
          if (live) {
            const now = performance.now();
            if (now - lastMatchUpdate.current > 120) {
              lastMatchUpdate.current = now;
              const percent = comparePoses(live, targetRef.current);
              setMatchPercent(percent);
              setBand(scoreBandFromMatch(percent));
            }
          }
        }
      });
    } catch (error) {
      setStatus(`Error: ${(error as Error).message}`);
      stop();
    }
  }

  return (
    <div className="projector-stage">
      <video ref={videoRef} muted playsInline className="hidden-video" />
      <canvas ref={canvasRef} width={1280} height={720} className="projector-canvas" />

      {/* Always-visible compact match HUD. */}
      <div className={`stage-hud band-${band.toLowerCase()}`}>
        <span className="match-band">{band}</span>
        <span className="match-percent">{matchPercent}%</span>
      </div>

      {/* Sidebar toggle. */}
      <button
        type="button"
        className="stage-toggle"
        aria-expanded={sidebarOpen}
        onClick={() => setSidebarOpen((open) => !open)}
      >
        {sidebarOpen ? "✕" : "☰ Controls"}
      </button>

      {/* Big start prompt only while idle. */}
      {!running && (
        <div className="start-overlay">
          <button className="primary-action start-button" type="button" onClick={start}>
            Start Pose Detection
          </button>
        </div>
      )}

      {/* Slide-out controls. */}
      <aside className={`stage-sidebar ${sidebarOpen ? "open" : ""}`}>
        <h2>Athlete Controls</h2>
        <p className="large-status">{status}</p>

        {poseOptions && poseOptions.length > 0 && (
          <div className="sidebar-section">
            <span className="sidebar-label">Target hole</span>
            <div className="sidebar-pose-buttons">
              {poseOptions.map((pose) => (
                <button
                  key={pose.id}
                  type="button"
                  className={pose.id === selectedPoseId ? "primary-action" : "secondary-action"}
                  onClick={() => onSelectPose?.(pose)}
                >
                  {pose.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="sidebar-section">
          {running ? (
            <button className="secondary-action" type="button" onClick={stop}>
              Stop
            </button>
          ) : (
            <button className="primary-action" type="button" onClick={start}>
              Start Pose Detection
            </button>
          )}
          <button
            className="secondary-action"
            type="button"
            onClick={() => toggleFullscreen(canvasRef.current?.parentElement ?? null)}
          >
            Toggle Fullscreen
          </button>
          <Link className="secondary-action" to="/">
            Back Home
          </Link>
        </div>
      </aside>
    </div>
  );
}

function toggleFullscreen(el: Element | null) {
  if (!el) {
    return;
  }
  if (document.fullscreenElement) {
    void document.exitFullscreen();
  } else {
    void el.requestFullscreen?.();
  }
}

/** Draw one live frame: mirrored camera + raw skeleton, with the hole overlaid. */
function drawFrame(
  ctx: CanvasRenderingContext2D,
  drawingUtils: DrawingUtils | null,
  video: HTMLVideoElement,
  landmarks: PoseFrame["landmarks"],
  target: UniversalPose
) {
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

  // Hole is drawn un-mirrored: the saboteur's screen-left lines up with the player's
  // screen-left in the mirrored camera.
  drawHoleOverlay(ctx, target, width, height);
}

/**
 * Tinted-wall overlay with a human-shaped hole punched clear. The area AROUND the
 * pose is a semi-transparent wall; the pose silhouette is left blank so the live
 * camera shows through it (the "hole in the wall" the athlete fits into).
 */
function drawHoleOverlay(
  ctx: CanvasRenderingContext2D,
  target: UniversalPose,
  width: number,
  height: number
) {
  const regionH = height;
  const regionW = height * HOLE_ASPECT;
  const x0 = (width - regionW) / 2;
  const radius = holeRadius(target.difficulty) * regionW;

  const jointMap = new Map(target.joints.map((j) => [j.name, j]));
  const px = (jx: number) => x0 + jx * regionW;
  const py = (jy: number) => jy * regionH;

  const strokeLimbs = (context: CanvasRenderingContext2D, lineWidth: number) => {
    context.lineWidth = lineWidth;
    for (const [from, to] of universalLimbs) {
      const a = jointMap.get(from);
      const b = jointMap.get(to);
      if (!a || !b) {
        continue;
      }
      context.beginPath();
      context.moveTo(px(a.x), py(a.y));
      context.lineTo(px(b.x), py(b.y));
      context.stroke();
    }
  };
  const fillJoints = (context: CanvasRenderingContext2D, r: number) => {
    for (const joint of target.joints) {
      context.beginPath();
      context.arc(px(joint.x), py(joint.y), joint.name === "head" ? r * 1.4 : r, 0, Math.PI * 2);
      context.fill();
    }
  };

  // Everything below happens on the offscreen wall layer, so the only thing that
  // touches the main camera canvas is a plain source-over composite.
  const wallCtx = getWallCtx(width, height);
  const rim = Math.max(3, regionW * 0.012);

  // 1) Paint the full tinted wall.
  wallCtx.fillStyle = WALL_TINT;
  wallCtx.fillRect(0, 0, width, height);

  // 2) Trace a glowing edge ring slightly larger than the hole.
  wallCtx.save();
  wallCtx.lineCap = "round";
  wallCtx.lineJoin = "round";
  wallCtx.strokeStyle = HOLE_EDGE;
  wallCtx.fillStyle = HOLE_EDGE;
  strokeLimbs(wallCtx, radius * 2 + rim * 2);
  fillJoints(wallCtx, radius + rim);
  wallCtx.restore();

  // 3) Carve the pose silhouette clear (transparent = the hole), leaving the ring.
  wallCtx.save();
  wallCtx.globalCompositeOperation = "destination-out";
  wallCtx.lineCap = "round";
  wallCtx.lineJoin = "round";
  wallCtx.strokeStyle = "#000";
  wallCtx.fillStyle = "#000";
  strokeLimbs(wallCtx, radius * 2);
  fillJoints(wallCtx, radius);
  wallCtx.restore();

  // 4) Composite the holed wall over the camera: camera shows through the hole,
  //    tint everywhere else, glowing rim around the boundary.
  ctx.drawImage(wallCtx.canvas, 0, 0);
}
