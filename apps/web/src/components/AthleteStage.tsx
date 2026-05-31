import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  BLOB_COLOR,
  HOLE_PADDING,
  buildBlobFigure,
  comparePoses,
  landmarksToUniversalPose,
  retargetPose,
  scoreBandFromMatch,
  universalHumanSize,
  type FigurePrimitive,
  type ScoreBand,
  type UniversalPose
} from "@quackhacks/shared";
import {
  getHandLandmarker,
  getPoseLandmarker,
  startPoseLoop,
  type PoseFrame
} from "../lib/poseTracker";
import { cx, largeStatus, primaryAction, secondaryAction } from "../lib/ui";

type AthleteStageProps = {
  /** The hole/wall the athlete is trying to fit into (from the saboteur, or a preset). */
  targetPose: UniversalPose;
  /** Optional test poses shown as a selector in the sidebar (omit for the real game). */
  poseOptions?: UniversalPose[];
  /** Ids within `poseOptions` that came from the saboteur (grouped separately in the menu). */
  savedPoseIds?: string[];
  selectedPoseId?: string;
  onSelectPose?: (pose: UniversalPose) => void;
};

// The hole keeps a human portrait shape (not stretched to the camera's aspect): a
// centered "doorway". HOLE_SCALE is the fraction of the frame height it occupies.
const HOLE_ASPECT = universalHumanSize.width / universalHumanSize.height;
const HOLE_SCALE = 0.8;
// Floor line height (fraction of the region) representing the ground.
const FLOOR_Y = 0.96;

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

// A closed/grabbing hand turns red so the grab reads at a glance.
const HAND_GRAB_COLOR = "#ff2424";

const UNIVERSAL_W = universalHumanSize.width;
const UNIVERSAL_H = universalHumanSize.height;

/**
 * Paint shared figure primitives onto a canvas. Coordinates are in universal-box
 * pixels; the caller is expected to have already applied a transform mapping that box
 * into the target region. This mirrors the SVG renderer on the saboteur side so the
 * dummy and the carved hole look identical on both screens.
 */
function paintFigure(ctx: CanvasRenderingContext2D, prims: FigurePrimitive[]) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const prim of prims) {
    switch (prim.kind) {
      case "capsule":
        ctx.strokeStyle = prim.fill;
        ctx.lineWidth = prim.width;
        ctx.beginPath();
        ctx.moveTo(prim.a.x, prim.a.y);
        ctx.lineTo(prim.b.x, prim.b.y);
        ctx.stroke();
        break;
      case "circle":
        ctx.fillStyle = prim.fill;
        ctx.beginPath();
        ctx.arc(prim.c.x, prim.c.y, prim.r, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "ellipse":
        ctx.fillStyle = prim.fill;
        ctx.beginPath();
        ctx.ellipse(prim.c.x, prim.c.y, prim.rx, prim.ry, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "polyline":
        ctx.strokeStyle = prim.stroke;
        ctx.lineWidth = prim.width;
        ctx.beginPath();
        prim.points.forEach((point, index) =>
          index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)
        );
        ctx.stroke();
        break;
      case "quad":
        ctx.strokeStyle = prim.stroke;
        ctx.lineWidth = prim.width;
        ctx.beginPath();
        ctx.moveTo(prim.from.x, prim.from.y);
        ctx.quadraticCurveTo(prim.control.x, prim.control.y, prim.to.x, prim.to.y);
        ctx.stroke();
        break;
      default:
        break;
    }
  }
}

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

const scoreBandClasses = {
  PERFECT: "border-[#75e2be]/60 text-[#75e2be] [&_.score-bar-fill]:bg-[#75e2be]",
  CLEAN: "border-[#ffd65c]/60 text-[#ffd65c] [&_.score-bar-fill]:bg-[#ffd65c]",
  CRASH: "border-[#ef5c6b]/60 text-[#ef5c6b] [&_.score-bar-fill]:bg-[#ef5c6b]"
} satisfies Record<ScoreBand, string>;

export function AthleteStage({
  targetPose,
  poseOptions,
  savedPoseIds,
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

          // Map the live body onto the universal dummy (mirrored to match the selfie
          // view), then retarget it onto the target hole's exact bone lengths so a
          // correctly-angled pose nests inside the outline regardless of the player's
          // real proportions. The same pose drives both the drawn dummy and the score.
          const aspect = (video.videoWidth || 16) / (video.videoHeight || 9);
          const live = landmarks ? landmarksToUniversalPose(landmarks, aspect, { mirror: true }) : null;
          const dummyPose = live ? retargetPose(live, targetRef.current) : null;

          // The puppet is hip-anchored to the hole (for fair, position-independent
          // scoring), so track the player's real horizontal frame position separately
          // and slide the drawn dummy to follow it.
          const lHip = landmarks?.[23];
          const rHip = landmarks?.[24];
          const hipFrameX = lHip && rHip ? (lHip.x + rHip.x) / 2 : null;

          if (ctx) {
            drawFrame(ctx, dummyPose, handClosed, targetRef.current, showDummyRef.current, hipFrameX);
          }

          const now = performance.now();
          if (now - lastHandUpdate.current > 120) {
            lastHandUpdate.current = now;
            setHandStates(hands.map((hand) => hand.closed));
            setGuidance(frameGuidance(landmarks));
          }

          if (dummyPose && now - lastMatchUpdate.current > 120) {
            lastMatchUpdate.current = now;
            const percent = comparePoses(dummyPose, targetRef.current);
            setMatchPercent(percent);
            setBand(scoreBandFromMatch(percent));
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
    <div className="fixed inset-0 z-40 overflow-hidden bg-[#05080c]">
      <video ref={videoRef} muted playsInline className="pointer-events-none absolute size-px opacity-0" />
      <canvas ref={canvasRef} width={1280} height={720} className="block h-full w-full object-cover" />

      {/* Big accuracy/score bar down the side of the screen. */}
      <div
        className={cx(
          "absolute top-6 bottom-6 left-5 z-42 flex w-[78px] flex-col items-center gap-2 rounded-[18px] border border-[#f6f4ea]/18 bg-[#05080c]/72 px-2 py-3 font-extrabold backdrop-blur-[10px]",
          scoreBandClasses[band]
        )}
      >
        <span className="text-2xl">{matchPercent}%</span>
        <div className="relative w-full flex-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="score-bar-fill absolute bottom-0 left-0 w-full bg-[#ef5c6b] transition-[height,background] duration-200 ease-linear"
            style={{ height: `${matchPercent}%` }}
          />
        </div>
        <span className="text-xs tracking-[0.06em]">{band}</span>
      </div>

      {/* Hand open/closed (grab) indicator. */}
      {handStates.length > 0 && (
        <div className="absolute bottom-6 left-24 z-42 flex gap-2">
          {handStates.map((closed, index) => (
            <span
              key={index}
              className={cx(
                "rounded-lg border border-[#f6f4ea]/18 bg-[#05080c]/62 px-3 py-2 font-extrabold text-[#d8e2df] backdrop-blur-lg",
                closed && "border-[#ff2424]/85 bg-[#ff2424]/16 text-[#ff5a5a]"
              )}
            >
              {closed ? "✊ Grab" : "✋ Open"}
            </span>
          ))}
        </div>
      )}

      {/* Out-of-frame guidance: dims the screen and pauses with big instructions. */}
      {running && guidance && (
        <div className="pointer-events-none absolute inset-0 z-44 flex flex-col items-center justify-center gap-5 bg-[#04070b]/72 text-center text-[#ffd65c] backdrop-blur-md">
          <span
            className="text-[clamp(4rem,12vw,9rem)] leading-none text-white/92 [text-shadow:0_0_24px_rgba(0,0,0,0.6)]"
            aria-hidden="true"
          >
            ⏸
          </span>
          <span className="px-6 text-[clamp(2.2rem,6vw,4.5rem)] font-black tracking-[0.01em] [text-shadow:0_2px_18px_rgba(0,0,0,0.7)]">{guidance}</span>
        </div>
      )}

      {/* Sidebar toggle. */}
      <button
        type="button"
        className="absolute top-4 right-4 z-43 min-h-10 cursor-pointer rounded-lg border border-[#f6f4ea]/22 bg-[#05080c]/62 px-4 py-2 font-extrabold text-[#f6f4ea] backdrop-blur-lg"
        aria-expanded={sidebarOpen}
        onClick={() => setSidebarOpen((open) => !open)}
      >
        {sidebarOpen ? "✕" : "☰ Controls"}
      </button>

      {/* Big start prompt only while idle. */}
      {!running && (
        <div className="absolute inset-0 z-41 grid place-items-center">
          <button className={cx(primaryAction, "px-7 py-4 text-xl")} type="button" onClick={start}>
            Start Pose Detection
          </button>
        </div>
      )}

      {/* Slide-out controls. */}
      <aside
        className={cx(
          "absolute top-0 right-0 z-42 flex h-full w-[min(340px,84vw)] flex-col gap-4 overflow-y-auto border-l border-[#f6f4ea]/16 bg-[#05080c]/92 px-5 pt-16 pb-5 backdrop-blur-[14px] transition-transform duration-200 ease-out",
          sidebarOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <h2 className="m-0 text-lg font-bold">Athlete Controls</h2>
        <p className={largeStatus}>{status}</p>

        {poseOptions && poseOptions.length > 0 && (
          <PoseMenu
            poseOptions={poseOptions}
            savedPoseIds={savedPoseIds}
            selectedPoseId={selectedPoseId}
            onSelectPose={onSelectPose}
          />
        )}

        <div className="flex flex-col gap-2">
          {running ? (
            <button className={secondaryAction} type="button" onClick={stop}>
              Stop
            </button>
          ) : (
            <button className={primaryAction} type="button" onClick={start}>
              Start Pose Detection
            </button>
          )}
          <button
            className={secondaryAction}
            type="button"
            aria-pressed={showDummy}
            onClick={() => setShowDummy((on) => !on)}
          >
            Dummy Overlay: {showDummy ? "On" : "Off"}
          </button>
          <button
            className={secondaryAction}
            type="button"
            onClick={() => toggleFullscreen(canvasRef.current?.parentElement ?? null)}
          >
            Toggle Fullscreen
          </button>
          <Link className={secondaryAction} to="/">
            Back Home
          </Link>
        </div>
      </aside>
    </div>
  );
}

type PoseMenuProps = {
  poseOptions: UniversalPose[];
  savedPoseIds?: string[];
  selectedPoseId?: string;
  onSelectPose?: (pose: UniversalPose) => void;
};

/** Sidebar pose picker, split into preset "starter" holes and saboteur-saved holes. */
function PoseMenu({ poseOptions, savedPoseIds, selectedPoseId, onSelectPose }: PoseMenuProps) {
  const savedSet = new Set(savedPoseIds ?? []);
  const starters = poseOptions.filter((pose) => !savedSet.has(pose.id));
  const saboteurPoses = poseOptions.filter((pose) => savedSet.has(pose.id));

  const renderButton = (pose: UniversalPose) => (
    <button
      key={pose.id}
      type="button"
      className={pose.id === selectedPoseId ? primaryAction : secondaryAction}
      onClick={() => onSelectPose?.(pose)}
    >
      {pose.name}
    </button>
  );

  return (
    <>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold uppercase text-[#aebbb8]">Starter holes</span>
        <div className="flex flex-col gap-2">{starters.map(renderButton)}</div>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold uppercase text-[#aebbb8]">Saboteur holes</span>
        {saboteurPoses.length > 0 ? (
          <div className="flex flex-col gap-2">{saboteurPoses.map(renderButton)}</div>
        ) : (
          <p className="m-0 text-sm leading-5 text-[#aebbb8]">
            None yet. Build and save a pose on the Saboteur page, then return here.
          </p>
        )}
      </div>
    </>
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

/** Draw one live frame: black backdrop, the hole, then the dummy on top. */
function drawFrame(
  ctx: CanvasRenderingContext2D,
  livePose: UniversalPose | null,
  handClosed: HandClosed,
  target: UniversalPose,
  showDummy: boolean,
  hipFrameX: number | null
) {
  const { width, height } = ctx.canvas;

  ctx.clearRect(0, 0, width, height);
  // Solid black backdrop instead of the live camera, so the hole reads as black.
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);

  // Hole is carved from the same blob silhouette the saboteur draws. The live pose is
  // already mirrored to match the selfie view, so no extra canvas mirror is needed.
  drawHoleOverlay(ctx, target, width, height);

  if (showDummy && livePose) {
    drawDummy(ctx, livePose, handClosed, width, height, hipFrameX);
  }
}

/** Map the universal box (0..320, 0..480) into the centered portrait hole region. */
function withRegionTransform(
  ctx: CanvasRenderingContext2D,
  region: Region,
  draw: () => void
) {
  ctx.save();
  ctx.translate(region.x0, region.y0);
  // The region preserves the universal box aspect, so this is a uniform scale.
  ctx.scale(region.w / UNIVERSAL_W, region.h / UNIVERSAL_H);
  draw();
  ctx.restore();
}

/**
 * Draw the athlete's dummy using the SAME blob figure as the saboteur (capsule body +
 * round head + face). The live pose has already been normalized onto the universal
 * dummy, so a tall and a short player produce the same-sized figure that lines up with
 * the hole. Closed/grabbing hands are recolored red on top.
 */
function drawDummy(
  ctx: CanvasRenderingContext2D,
  pose: UniversalPose,
  handClosed: HandClosed,
  width: number,
  height: number,
  hipFrameX: number | null
) {
  const region = holeRegion(width, height);
  const prims = buildBlobFigure(pose.joints, { withFace: true, faceMode: "happy", color: BLOB_COLOR });

  // Slide the (hip-anchored) puppet horizontally to the player's real, mirrored frame
  // position so moving left/right in front of the camera moves the dummy. The puppet's
  // hips sit at the hole's hip x; offset by the difference to the live frame spot.
  let followX = 0;
  if (hipFrameX !== null) {
    const hipsJoint = pose.joints.find((joint) => joint.name === "hips");
    const dummyHipsX = hipsJoint ? hipsJoint.x : 0.5;
    const mirroredFrameX = 1 - hipFrameX;
    followX = mirroredFrameX * width - (region.x0 + dummyHipsX * region.w);
  }

  // Recolor a grabbing hand: a red circle painted over the blue wrist blob.
  const jointAt = (name: UniversalPose["joints"][number]["name"]) => {
    const joint = pose.joints.find((candidate) => candidate.name === name);
    return joint ? { x: joint.x * UNIVERSAL_W, y: joint.y * UNIVERSAL_H } : null;
  };
  const grabPrims: FigurePrimitive[] = [];
  const leftWrist = jointAt("leftWrist");
  const rightWrist = jointAt("rightWrist");
  if (handClosed.left && leftWrist) {
    grabPrims.push({ kind: "circle", c: leftWrist, r: 17, fill: HAND_GRAB_COLOR });
  }
  if (handClosed.right && rightWrist) {
    grabPrims.push({ kind: "circle", c: rightWrist, r: 17, fill: HAND_GRAB_COLOR });
  }

  ctx.save();
  ctx.translate(followX, 0);
  withRegionTransform(ctx, region, () => paintFigure(ctx, [...prims, ...grabPrims]));
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
  const region = holeRegion(width, height);
  const { x0, y0, w: regionW, h: regionH } = region;

  // The hole is the blob silhouette (body inflated by HOLE_PADDING, no face) — the
  // exact same geometry the saboteur previews on their screen.
  const silhouette = buildBlobFigure(target.joints, { color: "#000", pad: HOLE_PADDING });

  // Everything below happens on the offscreen wall layer, so the only thing that
  // touches the main camera canvas is a plain source-over composite.
  const wallCtx = getWallCtx(width, height);

  // 1) Paint the full solid wall.
  wallCtx.fillStyle = WALL_COLOR;
  wallCtx.fillRect(0, 0, width, height);

  // 2) Carve the figure silhouette clear (transparent = the hole).
  wallCtx.save();
  wallCtx.globalCompositeOperation = "destination-out";
  withRegionTransform(wallCtx, region, () => paintFigure(wallCtx, silhouette));
  wallCtx.restore();

  // 3) Composite the holed wall over the camera: camera shows through the hole, solid
  //    color everywhere else.
  ctx.drawImage(wallCtx.canvas, 0, 0);

  // 4) Floor line: the ground.
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
