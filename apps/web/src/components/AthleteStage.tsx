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
// Floor line height (fraction of the region) the dummy's lowest foot is pinned to, so
// at least one foot is always on the ground regardless of the live pose.
const FLOOR_Y = 0.96;
// The dummy is drawn at a constant size: its torso is always this fraction of the
// region height, so it looks the same whether the player is near or far.
const DUMMY_TORSO = 0.29;

type Region = { x0: number; y0: number; w: number; h: number };

/** Centered portrait region shared by the hole overlay and the dummy. */
function holeRegion(width: number, height: number): Region {
  const h = height * HOLE_SCALE;
  const w = h * HOLE_ASPECT;
  return { x0: (width - w) / 2, y0: (height - h) / 2, w, h };
}

/**
 * Checks whether the player is fully framed and, if not, returns a short instruction
 * (e.g. "Step back", "Step left"). Returns null when the position is good. Directions
 * are given for the mirrored (selfie) view the player sees.
 */
function frameGuidance(landmarks: PoseFrame["landmarks"]): string | null {
  if (!landmarks) {
    return "Step into frame";
  }
  const key = [0, 11, 12, 23, 24, 25, 26, 27, 28]
    .map((i) => landmarks[i])
    .filter((lm): lm is NonNullable<typeof lm> => Boolean(lm));
  if (key.length < 6) {
    return "Step into frame";
  }

  const xs = key.map((p) => p.x);
  const ys = key.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const ankles = [landmarks[27], landmarks[28]];
  const feetShown = ankles.some((a) => a && (a.visibility ?? 1) > 0.5 && a.y < 0.99);
  const head = landmarks[0];

  // Mirror the horizontal axis to match what the player sees on screen.
  const dispMinX = 1 - maxX;
  const dispMaxX = 1 - minX;

  if (maxY > 0.99 || !feetShown) {
    return "Step back so your feet show";
  }
  if (head && head.y < 0.02) {
    return "Step back";
  }
  if (dispMaxX > 0.97) {
    return "Step left";
  }
  if (dispMinX < 0.03) {
    return "Step right";
  }
  if (maxY - minY < 0.45) {
    return "Step closer";
  }
  return null;
}

// Everything OUTSIDE the hole is a solid bright-yellow wall; the hole itself is
// punched clear so the live camera shows through it.
const WALL_COLOR = "#ffd60a";
// Backdrop behind the wall (the hole reads as black, matching the running view).
const IDLE_BACKDROP = "#000000";

// The ragdoll dummy is a simplistic, single cohesive humanoid (capsule limbs + neck +
// head) built from the live tracked body points, drawn as one solid bright-blue shape.
const RAGDOLL_COLOR = "#0a84ff";
// A closed/grabbing hand turns red so the grab reads at a glance.
const HAND_GRAB_COLOR = "#ff2424";

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
  const [guidance, setGuidance] = useState<string | null>(null);
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
      setHandStates([]);
      setGuidance(null);
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
          // Resolve grab state per side by matching each detected hand to the nearest
          // pose wrist (15 = left, 16 = right).
          const handClosed = { left: false, right: false };
          if (landmarks) {
            for (const hand of hands) {
              const hw = hand.landmarks[0];
              if (!hw) {
                continue;
              }
              const lwl = landmarks[15];
              const rwl = landmarks[16];
              const d15 = lwl ? Math.hypot(hw.x - lwl.x, hw.y - lwl.y) : Infinity;
              const d16 = rwl ? Math.hypot(hw.x - rwl.x, hw.y - rwl.y) : Infinity;
              if (d15 <= d16) {
                handClosed.left = handClosed.left || hand.closed;
              } else {
                handClosed.right = handClosed.right || hand.closed;
              }
            }
          }

          if (ctx) {
            drawFrame(
              ctx,
              drawingUtils,
              video,
              landmarks,
              handClosed,
              targetRef.current,
              showDummyRef.current
            );
          }

          const now = performance.now();
          if (now - lastHandUpdate.current > 120) {
            lastHandUpdate.current = now;
            setHandStates(hands.map((hand) => hand.closed));
            setGuidance(frameGuidance(landmarks));
          }

          if (landmarks) {
            const aspect = (video.videoWidth || 16) / (video.videoHeight || 9);
            const live = landmarksToUniversalPose(landmarks, aspect, { mirror: true });
            if (live && now - lastMatchUpdate.current > 120) {
              lastMatchUpdate.current = now;
              const percent = comparePoses(live, targetRef.current);
              setMatchPercent(percent);
              setBand(scoreBandFromMatch(percent));
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

      {/* Big accuracy/score bar down the side of the screen. */}
      <div className={`score-bar band-${band.toLowerCase()}`}>
        <span className="score-bar-percent">{matchPercent}%</span>
        <div className="score-bar-track">
          <div className="score-bar-fill" style={{ height: `${matchPercent}%` }} />
        </div>
        <span className="score-bar-band">{band}</span>
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

      {/* Out-of-frame guidance. */}
      {running && guidance && <div className="guidance-banner">{guidance}</div>}

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

type HandClosed = { left: boolean; right: boolean };

/** Draw one live frame: mirrored camera + skeleton, the hole, then the dummy on top. */
function drawFrame(
  ctx: CanvasRenderingContext2D,
  drawingUtils: DrawingUtils | null,
  video: HTMLVideoElement,
  landmarks: PoseFrame["landmarks"],
  handClosed: HandClosed,
  target: UniversalPose,
  showDummy: boolean
) {
  const { width, height } = ctx.canvas;

  ctx.save();
  ctx.clearRect(0, 0, width, height);
  // Solid black backdrop instead of the live camera, so the hole reads as black.
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);
  ctx.translate(width, 0);
  ctx.scale(-1, 1); // selfie mirror (keeps the skeleton aligned with the dummy)

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

  // The solid dummy sits on top of the wall, mirrored to match the selfie view. It is
  // normalized to a constant size and floor-anchored, so it looks the same no matter
  // how near/far the player stands.
  if (showDummy && landmarks) {
    ctx.save();
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
    drawRagdoll(ctx, landmarks, handClosed, width, height);
    ctx.restore();
  }
}

/**
 * Constant-size, floor-anchored dummy. Live landmarks are scaled around the hips so
 * the torso is always the same length (looks identical near or far), then translated
 * to center the figure and pin its lowest foot to the floor line. Hands render as an
 * oval (open) or a recolored circle (closed/grab).
 */
function drawRagdoll(
  ctx: CanvasRenderingContext2D,
  landmarks: NonNullable<PoseFrame["landmarks"]>,
  handClosed: HandClosed,
  width: number,
  height: number
) {
  type Pt = { x: number; y: number };
  const region = holeRegion(width, height);

  const raw = (i: number): Pt | null => {
    const lm = landmarks[i];
    if (!lm || (lm.visibility !== undefined && lm.visibility < 0.4)) {
      return null;
    }
    return { x: lm.x * width, y: lm.y * height };
  };

  const rls = raw(11);
  const rrs = raw(12);
  const rlh = raw(23);
  const rrh = raw(24);
  if (!rls || !rrs || !rlh || !rrh) {
    return;
  }

  // Normalization: scale around the hip center so the torso is a constant length.
  const hipCenter = { x: (rlh.x + rrh.x) / 2, y: (rlh.y + rrh.y) / 2 };
  const neckRaw = { x: (rls.x + rrs.x) / 2, y: (rls.y + rrs.y) / 2 };
  const torsoPx = Math.hypot(neckRaw.x - hipCenter.x, neckRaw.y - hipCenter.y) || 1;
  const scale = (region.h * DUMMY_TORSO) / torsoPx;
  const scaled = (p: Pt): Pt => ({
    x: hipCenter.x + (p.x - hipCenter.x) * scale,
    y: hipCenter.y + (p.y - hipCenter.y) * scale
  });

  // Keep the player's real horizontal position so the dummy can move left/right
  // (even outside the hole); only the size is normalized, not the side-to-side
  // location. Pin the lowest foot to the floor line so a foot is always grounded.
  const shiftX = 0;
  const ankleYs = [raw(27), raw(28)]
    .filter((a): a is Pt => Boolean(a))
    .map((a) => scaled(a).y);
  const floorPy = region.y0 + region.h * FLOOR_Y;
  const shiftY = ankleYs.length
    ? floorPy - Math.max(...ankleYs)
    : region.y0 + region.h * 0.55 - hipCenter.y;

  const pt = (i: number): Pt | null => {
    const p = raw(i);
    if (!p) {
      return null;
    }
    const s = scaled(p);
    return { x: s.x + shiftX, y: s.y + shiftY };
  };

  const ls = pt(11)!;
  const rs = pt(12)!;
  const lh = pt(23)!;
  const rh = pt(24)!;

  const le = pt(13);
  const re = pt(14);
  const lw = pt(15);
  const rw = pt(16);
  const lk = pt(25);
  const rk = pt(26);
  const la = pt(27);
  const ra = pt(28);
  const nose = pt(0);

  const shoulderW = Math.hypot(ls.x - rs.x, ls.y - rs.y) || region.w * 0.3;
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

  const headR = shoulderW * 0.42;
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
  // Stroke the same outline thickly to fatten and round the torso so it fills the
  // hole silhouette rather than reading as a thin slab.
  ctx.lineWidth = shoulderW * 0.24;
  ctx.stroke();

  // Rounded shoulder bar fuses the shoulders (and arm roots) into the torso.
  capsule(ls, rs, shoulderW * 0.34);

  // Neck links the head to the torso so there's no gap; all parts overlap into one
  // cohesive solid shape (everything is the same opaque color).
  capsule(headC, neck, shoulderW * 0.36);

  // Arms + legs as capsules (thicker so they match the chunky hole outline).
  capsule(ls, le, shoulderW * 0.34);
  capsule(le, lw, shoulderW * 0.3);
  capsule(rs, re, shoulderW * 0.34);
  capsule(re, rw, shoulderW * 0.3);
  capsule(lh, lk, shoulderW * 0.42);
  capsule(lk, la, shoulderW * 0.34);
  capsule(rh, rk, shoulderW * 0.42);
  capsule(rk, ra, shoulderW * 0.34);

  // Head.
  ctx.beginPath();
  ctx.arc(headC.x, headC.y, headR, 0, Math.PI * 2);
  ctx.fill();

  // Hands: an oval when open, a recolored circle when grabbing.
  const handSize = shoulderW * 0.26;
  const drawHand = (wrist: Pt | null, elbow: Pt | null, closed: boolean) => {
    if (!wrist) {
      return;
    }
    const dx = elbow ? wrist.x - elbow.x : 0;
    const dy = elbow ? wrist.y - elbow.y : 1;
    const len = Math.hypot(dx, dy) || 1;
    const dir = { x: dx / len, y: dy / len }; // forearm → hand direction
    const cx = wrist.x + dir.x * handSize * 0.5;
    const cy = wrist.y + dir.y * handSize * 0.5;

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

  drawHand(lw, le, handClosed.left);
  drawHand(rw, re, handClosed.right);

  ctx.restore();
}

/**
 * Solid bright-yellow wall with a human-shaped hole punched clear. The area AROUND the
 * pose is opaque; the pose silhouette is left blank so the live camera shows through
 * it (the "hole in the wall" the athlete fits into). Also draws the floor line.
 */
function drawHoleOverlay(
  ctx: CanvasRenderingContext2D,
  target: UniversalPose,
  width: number,
  height: number
) {
  const { x0, y0, w: regionW, h: regionH } = holeRegion(width, height);
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
  //    color everywhere else.
  ctx.drawImage(wallCtx.canvas, 0, 0);

  // 4) Floor line: the ground the dummy's foot is pinned to.
  const floorY = y0 + regionH * FLOOR_Y;
  ctx.save();
  ctx.strokeStyle = "rgba(20, 24, 28, 0.55)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x0, floorY);
  ctx.lineTo(x0 + regionW, floorY);
  ctx.stroke();
  ctx.restore();
}
