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
  getHandLandmarker,
  getPoseLandmarker,
  startPoseLoop,
  type HandInfo,
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
// centered "doorway". HOLE_SCALE is the fraction of the frame height it occupies.
const HOLE_ASPECT = universalHumanSize.width / universalHumanSize.height;
const HOLE_SCALE = 0.8;

// Everything OUTSIDE the hole is a solid bright-blue wall; the hole itself is punched
// clear so the live camera shows through it.
const WALL_COLOR = "#0a84ff";
// Backdrop used for the idle preview, so the cut-out hole is visible before the
// camera starts.
const IDLE_BACKDROP = "#0a1117";

// The ragdoll dummy is a simplistic, single cohesive humanoid (capsule limbs + neck +
// head) built from the live tracked body points, drawn as one solid bright-red shape.
const RAGDOLL_COLOR = "#ff2424";
// A closed/grabbing hand is highlighted in this accent so the grab reads at a glance.
const HAND_GRAB_COLOR = "#ffe14d";

// MediaPipe pose landmark indices 0–10 are face (nose/eyes/ears/mouth); 11+ is body.
const FIRST_BODY_LANDMARK = 11;

// Skeleton connections with both endpoints on the body (drops the face mesh lines).
const BODY_CONNECTIONS = PoseLandmarker.POSE_CONNECTIONS.filter(
  (c) => c.start >= FIRST_BODY_LANDMARK && c.end >= FIRST_BODY_LANDMARK
);

function makeOffscreen(): (width: number, height: number) => CanvasRenderingContext2D {
  let canvas: HTMLCanvasElement | null = null;
  return (width, height) => {
    if (!canvas) {
      canvas = document.createElement("canvas");
    }
    if (canvas.width !== width) {
      canvas.width = width;
    }
    if (canvas.height !== height) {
      canvas.height = height;
    }
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, width, height);
    return ctx;
  };
}

// Reusable offscreen layer for the wall: we carve the hole out of it, then composite
// over the camera so the carve never erases camera pixels.
const getWallCtx = makeOffscreen();

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
  const [showDummy, setShowDummy] = useState(true);
  const [handStates, setHandStates] = useState<boolean[]>([]);
  const lastHandUpdate = useRef(0);

  // The render loop reads this through a ref so toggling doesn't rebuild the loop.
  const showDummyRef = useRef(showDummy);
  showDummyRef.current = showDummy;

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

      setStatus("Loading MediaPipe models");
      const [landmarker, handLandmarker] = await Promise.all([
        getPoseLandmarker(),
        getHandLandmarker()
      ]);

      const ctx = canvas?.getContext("2d") ?? null;
      const drawingUtils = ctx ? new DrawingUtils(ctx) : null;

      setStatus("Tracking");
      setRunning(true);
      setSidebarOpen(false);

      stopLoopRef.current = startPoseLoop(
        video,
        landmarker,
        ({ landmarks, hands }) => {
          if (ctx) {
            drawFrame(
              ctx,
              drawingUtils,
              video,
              landmarks,
              hands,
              targetRef.current,
              showDummyRef.current
            );
          }

          const handNow = performance.now();
          if (handNow - lastHandUpdate.current > 120) {
            lastHandUpdate.current = handNow;
            setHandStates(hands.map((hand) => hand.closed));
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
        },
        handLandmarker
      );
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

      {/* Hand open/closed (grab) indicator. */}
      {handStates.length > 0 && (
        <div className="hands-hud">
          {handStates.map((closed, index) => (
            <span key={index} className={`hand-chip ${closed ? "grab" : "open"}`}>
              {closed ? "✊ Grab" : "✋ Open"}
            </span>
          ))}
        </div>
      )}

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
            aria-pressed={showDummy}
            onClick={() => setShowDummy((on) => !on)}
          >
            Dummy Overlay: {showDummy ? "On" : "Off"}
          </button>
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

/** Draw one live frame: mirrored camera + optional ragdoll + skeleton, then the hole. */
function drawFrame(
  ctx: CanvasRenderingContext2D,
  drawingUtils: DrawingUtils | null,
  video: HTMLVideoElement,
  landmarks: PoseFrame["landmarks"],
  hands: HandInfo[],
  target: UniversalPose,
  showDummy: boolean
) {
  const { width, height } = ctx.canvas;

  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.translate(width, 0);
  ctx.scale(-1, 1); // selfie mirror
  ctx.drawImage(video, 0, 0, width, height);

  if (landmarks && drawingUtils) {
    // Body only — face mesh (eyes/mouth/ears) lines and dots are dropped.
    drawingUtils.drawConnectors(landmarks, BODY_CONNECTIONS, {
      color: "#75e2be",
      lineWidth: 4
    });
    drawingUtils.drawLandmarks(landmarks.slice(FIRST_BODY_LANDMARK), {
      color: "#ffd65c",
      radius: 4
    });
  }
  ctx.restore();

  // Hole is drawn un-mirrored: the saboteur's screen-left lines up with the player's
  // screen-left in the mirrored camera.
  drawHoleOverlay(ctx, target, width, height);

  // The solid ragdoll sits on top of the blue wall so it's fully visible (mirrored to
  // align with the camera).
  if (showDummy && landmarks) {
    ctx.save();
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
    drawRagdoll(ctx, landmarks, hands, width, height);
    ctx.restore();
  }
}

/**
 * Simplistic ragdoll: capsule limbs, a squared torso, head, and hands, scaled by the
 * player's shoulder width so it tracks their actual body. Hands render open (spread
 * fingers) or closed (a fist highlighted in the grab color) from the hand detector.
 */
function drawRagdoll(
  ctx: CanvasRenderingContext2D,
  landmarks: NonNullable<PoseFrame["landmarks"]>,
  hands: HandInfo[],
  width: number,
  height: number
) {
  type Pt = { x: number; y: number };
  const pt = (i: number): Pt | null => {
    const lm = landmarks[i];
    if (!lm || (lm.visibility !== undefined && lm.visibility < 0.4)) {
      return null;
    }
    return { x: lm.x * width, y: lm.y * height };
  };

  const ls = pt(11);
  const rs = pt(12);
  const lh = pt(23);
  const rh = pt(24);
  if (!ls || !rs || !lh || !rh) {
    return;
  }

  const le = pt(13);
  const re = pt(14);
  const lw = pt(15);
  const rw = pt(16);
  const lk = pt(25);
  const rk = pt(26);
  const la = pt(27);
  const ra = pt(28);
  const nose = pt(0);

  const shoulderW = Math.hypot(ls.x - rs.x, ls.y - rs.y) || width * 0.1;
  const neck = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 };

  const capsule = (a: Pt | null, b: Pt | null, w: number) => {
    if (!a || !b) {
      return;
    }
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  };

  const headR = shoulderW * 0.36;
  const headC = nose ?? { x: neck.x, y: neck.y - headR * 1.3 };

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.fillStyle = RAGDOLL_COLOR;
  ctx.strokeStyle = RAGDOLL_COLOR;

  // Squared torso: the bottom corners sit directly under the shoulders (vertical
  // sides) so it reads as a rectangle rather than a tapered trapezoid.
  const torso = [ls, rs, { x: rs.x, y: rh.y }, { x: ls.x, y: lh.y }];
  ctx.beginPath();
  ctx.moveTo(torso[0].x, torso[0].y);
  for (let i = 1; i < torso.length; i += 1) {
    ctx.lineTo(torso[i].x, torso[i].y);
  }
  ctx.closePath();
  ctx.fill();

  // Slim rounded shoulder bar fuses the shoulders (and arm roots) into the torso
  // without bulking up the top of the figure.
  capsule(ls, rs, shoulderW * 0.3);

  // Neck links the head to the torso so there's no gap; all parts overlap into one
  // cohesive solid shape (everything is the same opaque red).
  capsule(headC, neck, shoulderW * 0.3);

  // Arms + legs as capsules (generous widths so they fuse with the torso).
  capsule(ls, le, shoulderW * 0.26);
  capsule(le, lw, shoulderW * 0.22);
  capsule(rs, re, shoulderW * 0.26);
  capsule(re, rw, shoulderW * 0.22);
  capsule(lh, lk, shoulderW * 0.32);
  capsule(lk, la, shoulderW * 0.26);
  capsule(rh, rk, shoulderW * 0.32);
  capsule(rk, ra, shoulderW * 0.26);

  // Head.
  ctx.beginPath();
  ctx.arc(headC.x, headC.y, headR, 0, Math.PI * 2);
  ctx.fill();

  // Hands: match each detected hand to the nearest wrist, then draw it open (spread
  // fingers, body red) or closed (a fist highlighted in the grab color).
  const handAt = (wrist: Pt | null): HandInfo | null => {
    if (!wrist) {
      return null;
    }
    let best: HandInfo | null = null;
    let bestDist = shoulderW * 1.3; // must be reasonably near the wrist to count
    for (const hand of hands) {
      const hw = hand.landmarks[0];
      if (!hw) {
        continue;
      }
      const d = Math.hypot(hw.x * width - wrist.x, hw.y * height - wrist.y);
      if (d < bestDist) {
        bestDist = d;
        best = hand;
      }
    }
    return best;
  };

  const handSize = shoulderW * 0.22;
  const drawHand = (wrist: Pt | null, elbow: Pt | null, info: HandInfo | null) => {
    if (!wrist) {
      return;
    }
    const dx = elbow ? wrist.x - elbow.x : 0;
    const dy = elbow ? wrist.y - elbow.y : 1;
    const len = Math.hypot(dx, dy) || 1;
    const dir = { x: dx / len, y: dy / len }; // forearm → hand direction
    const cx = wrist.x + dir.x * handSize * 0.5;
    const cy = wrist.y + dir.y * handSize * 0.5;
    const closed = info?.closed ?? false;

    ctx.fillStyle = closed ? HAND_GRAB_COLOR : RAGDOLL_COLOR;
    ctx.beginPath();
    if (closed) {
      // Grab: a circle in the grab color.
      ctx.arc(cx, cy, handSize * 0.8, 0, Math.PI * 2);
    } else {
      // Open: an oval elongated along the forearm, in the body color.
      ctx.ellipse(cx, cy, handSize * 1.1, handSize * 0.6, Math.atan2(dir.y, dir.x), 0, Math.PI * 2);
    }
    ctx.fill();
  };

  drawHand(lw, le, handAt(lw));
  drawHand(rw, re, handAt(rw));

  ctx.restore();
}

/**
 * Solid bright-blue wall with a human-shaped hole punched clear. The area AROUND the
 * pose is opaque blue; the pose silhouette is left blank so the live camera shows
 * through it (the "hole in the wall" the athlete fits into).
 */
function drawHoleOverlay(
  ctx: CanvasRenderingContext2D,
  target: UniversalPose,
  width: number,
  height: number
) {
  const regionH = height * HOLE_SCALE;
  const regionW = regionH * HOLE_ASPECT;
  const x0 = (width - regionW) / 2;
  const y0 = (height - regionH) / 2;
  const radius = holeRadius(target.difficulty) * regionW;

  const jointMap = new Map(target.joints.map((j) => [j.name, j]));
  const px = (jx: number) => x0 + jx * regionW;
  const py = (jy: number) => y0 + jy * regionH;

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

  // 1) Paint the full solid blue wall.
  wallCtx.fillStyle = WALL_COLOR;
  wallCtx.fillRect(0, 0, width, height);

  // 2) Carve the pose silhouette clear (transparent = the hole).
  wallCtx.save();
  wallCtx.globalCompositeOperation = "destination-out";
  wallCtx.lineCap = "round";
  wallCtx.lineJoin = "round";
  wallCtx.strokeStyle = "#000";
  wallCtx.fillStyle = "#000";
  strokeLimbs(wallCtx, radius * 2);
  fillJoints(wallCtx, radius);
  wallCtx.restore();

  // 3) Composite the holed wall over the camera: camera shows through the hole, solid
  //    blue everywhere else.
  ctx.drawImage(wallCtx.canvas, 0, 0);
}
