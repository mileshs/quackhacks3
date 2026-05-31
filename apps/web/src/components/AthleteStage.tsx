import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type p5 from "p5";
import {
  DEFAULT_POWERUP_DURATION_MS,
  GameRole,
  HOLE_PADDING,
  buildBlobFigure,
  comparePoses,
  landmarksToUniversalPose,
  retargetPose,
  scoreBandFromMatch,
  universalHumanSize,
  type FigurePrimitive,
  type PowerupActivatePayload,
  type RoundSnapshotPayload,
  type SaboteurPowerupKind,
  type ScoreBand,
  type UniversalPose
} from "@quackhacks/shared";
import {
  getHandLandmarker,
  getPoseLandmarker,
  startPoseLoop,
  type PoseFrame
} from "../lib/poseTracker";
import type { SoundEffectId } from "../lib/audioEngine";
import { drawDummyScene3D, type HandClosed, type ScreenPoint } from "../lib/dummy3d";
import { useRoleScopedSound } from "../hooks/useRoleScopedSound";
import { useDefeatSequence } from "../lib/defeatSequence";
import { useSound } from "../providers/SoundProvider";
import { showGameNotice } from "../lib/gameNotifications";
import { useDevSection, useEffectiveDevGameplay, useSettings } from "../lib/settings";
import { isHoleVisiblePhase, useGameTempo } from "../lib/tempo";
import { cx } from "../lib/ui";
import { buildGameCaptureImages, buildRoundCaptureImages, type GameCaptureImages } from "../lib/gameCapture";
import { SettingsToggle } from "./SettingsToggle";

// ── "Poses for Dummies" HUD palette ──────────────────────────────────────────
const INK = "#2b303b"; // dark navy from the logo
const BAND_COLOR: Record<ScoreBand, string> = {
  PERFECT: "#2fb86b",
  CLEAN: "#f0a52e",
  CRASH: "#ef5c6b"
};

// Soft cream card with a layered shadow + inset top highlight so it pops off the page.
const hudCard =
  "rounded-[18px] bg-[#fdf6e8] shadow-[inset_0_1.5px_0_rgba(255,255,255,0.9),0_2px_3px_rgba(0,0,0,0.12),0_12px_24px_rgba(80,55,0,0.3)]";
const hudLabel = "block text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#a89a82]";
const SCORE_FLIGHT_MS = 1_050;
const SCORE_FLIGHT_PRUNE_MS = 250;

// Cream pill button (logo-dark text), and a yellow "primary" variant. Both get a raised,
// 3D look via an inset top highlight, a tight contact shadow, and a soft cast shadow.
const pillBase =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[16px] px-4 py-3 font-extrabold text-[#2b303b] no-underline transition-transform active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50";
const pillSecondary = cx(
  pillBase,
  "bg-[#fdf6e8] shadow-[inset_0_1.5px_0_rgba(255,255,255,0.95),0_2px_3px_rgba(0,0,0,0.14),0_9px_18px_rgba(70,50,0,0.3)] hover:bg-white"
);
const pillPrimary = cx(
  pillBase,
  "bg-[#ffc83d] shadow-[inset_0_1.5px_0_rgba(255,255,255,0.6),0_2px_3px_rgba(0,0,0,0.16),0_9px_18px_rgba(180,120,0,0.45)] hover:brightness-[1.04]"
);

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6 shrink-0 drop-shadow-[0_2px_3px_rgba(120,80,0,0.5)]" fill="#ffc83d" aria-hidden="true">
      <path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.58 1.1 6.47L12 17.4l-5.8 3.05 1.1-6.47L2.6 9.35l6.5-.95L12 2.5z" />
    </svg>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-14 shrink-0 drop-shadow-[0_3px_6px_rgba(0,0,0,0.28)]" aria-hidden="true">
      <path
        d="M12 20.5l-1.45-1.32C5.4 14.5 2 11.42 2 7.62 2 4.9 4.13 2.75 6.85 2.75c1.54 0 3.02.72 4 1.86.98-1.14 2.46-1.86 4-1.86C21.57 2.75 23.7 4.9 23.7 7.62c0 .12 0 .24-.02.36C23.46 11.5 20.2 14.5 13.45 19.18L12 20.5z"
        transform="translate(-1.85 0)"
        fill={filled ? "#ff5564" : "#e7d9bc"}
      />
      {filled && (
        <ellipse cx="8" cy="8.6" rx="2.4" ry="1.6" fill="rgba(255,255,255,0.6)" transform="rotate(-32 8 8.6)" />
      )}
    </svg>
  );
}

function FullscreenIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6 shrink-0 drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4" />
    </svg>
  );
}

type AthleteStageProps = {
  /** The hole/wall the athlete is trying to fit into (from the saboteur, or a preset). */
  targetPose: UniversalPose;
  /** Optional test poses shown as a selector in the sidebar (omit for the real game). */
  poseOptions?: UniversalPose[];
  /** Ids within `poseOptions` that came from the saboteur (grouped separately in the menu). */
  savedPoseIds?: string[];
  selectedPoseId?: string;
  onSelectPose?: (pose: UniversalPose) => void;
  powerupActivation?: PowerupActivatePayload | null;
  onFinishWall?: (payload: RoundSnapshotPayload) => void;
  /** Resets lives when a new playing session starts (e.g. `game.playingStartedAt`). */
  playingSessionKey?: string | null;
  /** Called once after the death sound ends when all lives are lost. */
  onAllLivesLost?: () => void;
  /** Poses to pick from when generating capture images. */
  capturePosePool?: UniversalPose[];
  /** Fired after every scored wall with webcam + in-game wall images. */
  onRoundCapture?: (capture: GameCaptureImages) => void;
  /** Dev / test hook after capture is rendered. */
  onCaptureShot?: (capture: GameCaptureImages) => void;
};

const STARTING_LIVES = 3;

const POWERUP_SFX = {
  blindness: "blindness",
  mirror: "mirror"
} as const satisfies Record<SaboteurPowerupKind, SoundEffectId>;

// The hole keeps a human portrait shape (not stretched to the camera's aspect): a
// centered "doorway". HOLE_SCALE is the fraction of the frame height it occupies.
const HOLE_ASPECT = universalHumanSize.width / universalHumanSize.height;
const HOLE_SCALE = 0.8;

type Region = { x0: number; y0: number; w: number; h: number };

type RectMetrics = { left: number; top: number; width: number; height: number };
type ScoreFlight = {
  id: number;
  points: number;
  from: ScreenPoint;
  mid: ScreenPoint;
  to: ScreenPoint;
  rotate: number;
  duration: number;
};

type PoseDebugInfo = {
  canvas: {
    width: number;
    height: number;
    css: RectMetrics;
    coverScale: number;
    coverOffsetX: number;
    coverOffsetY: number;
  };
  p5Canvas: {
    width: number;
    height: number;
    css: RectMetrics;
    deltaLeft: number;
    deltaTop: number;
    deltaWidth: number;
    deltaHeight: number;
  } | null;
  rawHipX: number | null;
  mirroredHipX: number | null;
  playerBoxX: number | null;
  preAnchorHipX: number | null;
  dummyHipX: number | null;
  targetHipX: number | null;
  dxBox: number | null;
  screenX: {
    stageCenter: number;
    holeCenter: number;
    measuredHip: number | null;
    targetHip: number | null;
    dummyHip: number | null;
  };
  linePct: {
    stageCenter: number;
    holeCenter: number;
    measuredHip: number | null;
    targetHip: number | null;
    dummyHip: number | null;
  };
  deltas: {
    measuredMinusCenter: number | null;
    dummyMinusMeasured: number | null;
    dummyMinusHoleCenter: number | null;
  };
};

/** Centered portrait region shared by the hole overlay and the dummy. */
function holeRegion(width: number, height: number): Region {
  const h = height * HOLE_SCALE;
  const w = h * HOLE_ASPECT;
  return { x0: (width - w) / 2, y0: (height - h) / 2, w, h };
}

function finiteOrNull(value: number | null | undefined): number | null {
  return value !== null && value !== undefined && Number.isFinite(value) ? value : null;
}

function rectMetrics(rect: DOMRect): RectMetrics {
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height
  };
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

const SCORE_SPAWN_JOINTS: Array<UniversalPose["joints"][number]["name"]> = [
  "neck",
  "leftShoulder",
  "rightShoulder",
  "hips"
];

function averagePosePoint(
  pose: UniversalPose,
  names: Array<UniversalPose["joints"][number]["name"]>
): ScreenPoint | null {
  const points = names
    .map((name) => pose.joints.find((joint) => joint.name === name))
    .filter((joint): joint is UniversalPose["joints"][number] =>
      Boolean(joint && Number.isFinite(joint.x) && Number.isFinite(joint.y))
    );

  if (points.length === 0) {
    return null;
  }

  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length
  };
}

function canvasPointToStagePoint(
  canvas: HTMLCanvasElement,
  stageRect: DOMRect,
  point: ScreenPoint
): ScreenPoint | null {
  const canvasRect = canvas.getBoundingClientRect();
  if (!(canvas.width > 0 && canvas.height > 0 && canvasRect.width > 0 && canvasRect.height > 0)) {
    return null;
  }

  const coverScale = Math.max(canvasRect.width / canvas.width, canvasRect.height / canvas.height);
  const coverOffsetX = (canvasRect.width - canvas.width * coverScale) / 2;
  const coverOffsetY = (canvasRect.height - canvas.height * coverScale) / 2;

  return {
    x: canvasRect.left - stageRect.left + coverOffsetX + point.x * coverScale,
    y: canvasRect.top - stageRect.top + coverOffsetY + point.y * coverScale
  };
}

function scoreSpawnPoint(
  stageRect: DOMRect,
  canvas: HTMLCanvasElement | null,
  pose: UniversalPose | null
): ScreenPoint {
  const fallback = {
    x: stageRect.width * randomBetween(0.44, 0.58),
    y: stageRect.height * randomBetween(0.38, 0.56)
  };

  const torso = pose ? averagePosePoint(pose, SCORE_SPAWN_JOINTS) : null;
  if (!canvas || !torso) {
    return fallback;
  }

  const region = holeRegion(canvas.width, canvas.height);
  const canvasPoint = {
    x: region.x0 + torso.x * region.w,
    y: region.y0 + torso.y * region.h
  };
  const stagePoint = canvasPointToStagePoint(canvas, stageRect, canvasPoint) ?? fallback;
  const jitterX = Math.min(92, Math.max(34, stageRect.width * 0.09));
  const jitterY = Math.min(72, Math.max(28, stageRect.height * 0.07));

  return {
    x: clampNumber(stagePoint.x + randomBetween(-jitterX, jitterX), 24, Math.max(24, stageRect.width - 24)),
    y: clampNumber(stagePoint.y + randomBetween(-jitterY, jitterY), 24, Math.max(24, stageRect.height - 24))
  };
}

function getHipX(pose: UniversalPose | null): number | null {
  return finiteOrNull(pose?.joints.find((joint) => joint.name === "hips")?.x);
}

function buildPoseDebugInfo(
  canvas: HTMLCanvasElement,
  dummyMount: HTMLDivElement | null,
  hipFrameX: number | null,
  preAnchorPose: UniversalPose | null,
  dummyPose: UniversalPose | null,
  target: UniversalPose
): PoseDebugInfo {
  const width = canvas.width;
  const height = canvas.height;
  const region = holeRegion(width, height);
  const canvasCss = rectMetrics(canvas.getBoundingClientRect());
  const p5Canvas = dummyMount?.querySelector("canvas") ?? null;
  const p5Css = p5Canvas ? rectMetrics(p5Canvas.getBoundingClientRect()) : null;

  const coverScale =
    width > 0 && height > 0
      ? Math.max(canvasCss.width / width, canvasCss.height / height)
      : 1;
  const coverOffsetX = (canvasCss.width - width * coverScale) / 2;
  const coverOffsetY = (canvasCss.height - height * coverScale) / 2;
  const toDisplayedPct = (canvasX: number | null) =>
    canvasX === null || canvasCss.width <= 0
      ? null
      : ((coverOffsetX + canvasX * coverScale) / canvasCss.width) * 100;

  const mirroredHipX = hipFrameX === null ? null : 1 - hipFrameX;
  const measuredHipScreenX = mirroredHipX === null ? null : mirroredHipX * width;
  const playerBoxX =
    hipFrameX === null || !(region.w > 0)
      ? null
      : ((1 - hipFrameX) * width - region.x0) / region.w;
  const preAnchorHipX = getHipX(preAnchorPose);
  const dummyHipX = getHipX(dummyPose);
  const targetHipX = getHipX(target);
  const boxToScreenX = (boxX: number | null) => (boxX === null ? null : region.x0 + boxX * region.w);
  const stageCenter = width / 2;
  const holeCenter = region.x0 + region.w / 2;
  const targetHipScreenX = boxToScreenX(targetHipX);
  const dummyHipScreenX = boxToScreenX(dummyHipX);

  return {
    canvas: {
      width,
      height,
      css: canvasCss,
      coverScale,
      coverOffsetX,
      coverOffsetY
    },
    p5Canvas: p5Canvas && p5Css
      ? {
          width: p5Canvas.width,
          height: p5Canvas.height,
          css: p5Css,
          deltaLeft: p5Css.left - canvasCss.left,
          deltaTop: p5Css.top - canvasCss.top,
          deltaWidth: p5Css.width - canvasCss.width,
          deltaHeight: p5Css.height - canvasCss.height
        }
      : null,
    rawHipX: finiteOrNull(hipFrameX),
    mirroredHipX: finiteOrNull(mirroredHipX),
    playerBoxX: finiteOrNull(playerBoxX),
    preAnchorHipX,
    dummyHipX,
    targetHipX,
    dxBox: preAnchorHipX === null || dummyHipX === null ? null : dummyHipX - preAnchorHipX,
    screenX: {
      stageCenter,
      holeCenter,
      measuredHip: measuredHipScreenX,
      targetHip: targetHipScreenX,
      dummyHip: dummyHipScreenX
    },
    linePct: {
      stageCenter: toDisplayedPct(stageCenter) ?? 50,
      holeCenter: toDisplayedPct(holeCenter) ?? 50,
      measuredHip: toDisplayedPct(measuredHipScreenX),
      targetHip: toDisplayedPct(targetHipScreenX),
      dummyHip: toDisplayedPct(dummyHipScreenX)
    },
    deltas: {
      measuredMinusCenter: measuredHipScreenX === null ? null : measuredHipScreenX - stageCenter,
      dummyMinusMeasured:
        dummyHipScreenX === null || measuredHipScreenX === null ? null : dummyHipScreenX - measuredHipScreenX,
      dummyMinusHoleCenter: dummyHipScreenX === null ? null : dummyHipScreenX - holeCenter
    }
  };
}

function syncDummyCanvasCss(mount: HTMLDivElement | null) {
  const canvas = mount?.querySelector("canvas");
  if (!canvas) {
    return;
  }

  // p5 writes inline pixel dimensions (for example width: 1280px), which beat
  // Tailwind's w-full/h-full classes and make the WebGL dummy canvas narrower than
  // the 2D hole canvas. Force the overlay box to match the parent every frame.
  canvas.style.position = "absolute";
  canvas.style.inset = "0";
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.objectFit = "cover";
}

/** Lowest ankle y (largest value = closest to the floor) of a pose, or null if none. */
function lowestAnkleY(pose: UniversalPose): number | null {
  const ys = pose.joints
    .filter((joint) => joint.name === "leftAnkle" || joint.name === "rightAnkle")
    .map((joint) => joint.y);
  return ys.length ? Math.max(...ys) : null;
}

/**
 * Anchor the angle-retargeted puppet to the player's ACTUAL position in the hole's frame:
 *  • horizontally, shift so the hips sit under the player's real (mirrored) frame position;
 *  • vertically, plant the lowest foot on the hole's floor (one foot always on the ground).
 *
 * `retargetPose` rebuilds the player with the target's bone lengths but pins the result at
 * the target's hips. Translating that rigid pose onto the player's real location makes the
 * rendered body and the silhouette-containment score respond to walking left/right instead
 * of pretending the player is always centered in the hole.
 *
 * `hipFrameX` is the player's raw (un-mirrored) hip-center in frame units.
 */
function anchorDummyToPlayer(
  pose: UniversalPose,
  target: UniversalPose,
  hipFrameX: number,
  width: number,
  height: number
): UniversalPose {
  const region = holeRegion(width, height);
  if (!(region.w > 0)) {
    return pose; // canvas not sized yet — don't risk a divide-by-zero shift
  }
  const hips = pose.joints.find((joint) => joint.name === "hips");
  // Player's mirrored hip position expressed in the hole's box-x units (0 = hole's left
  // edge, 1 = right edge), the same 0..1 space the target pose lives in.
  const playerBoxX = ((1 - hipFrameX) * width - region.x0) / region.w;
  const rawDx = hips ? playerBoxX - hips.x : 0;
  const dx = Number.isFinite(rawDx) ? rawDx : 0;

  const dummyFloor = lowestAnkleY(pose);
  const targetFloor = lowestAnkleY(target);
  const rawDy = dummyFloor !== null && targetFloor !== null ? targetFloor - dummyFloor : 0;
  const dy = Number.isFinite(rawDy) ? rawDy : 0;

  if (dx === 0 && dy === 0) {
    return pose;
  }
  return { ...pose, joints: pose.joints.map((joint) => ({ ...joint, x: joint.x + dx, y: joint.y + dy })) };
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
  const minVisibility = 0.3;
  const edgeMargin = 0.06;
  const minBodyHeight = 0.36;
  const visibleEnough = (lm: NonNullable<PoseFrame["landmarks"]>[number] | undefined) =>
    Boolean(lm && (lm.visibility ?? 1) >= minVisibility);

  const key = [0, 11, 12, 23, 24, 25, 26, 27, 28]
    .map((i) => landmarks[i])
    .filter((lm): lm is NonNullable<typeof lm> => visibleEnough(lm));
  if (key.length < 6) {
    return "Step into frame";
  }

  const xs = key.map((p) => p.x);
  const ys = key.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const lowerBodyPoints = [landmarks[25], landmarks[26], landmarks[27], landmarks[28]].filter(visibleEnough);
  const ankles = [landmarks[27], landmarks[28]];
  const feetShown = ankles.some((ankle) => visibleEnough(ankle) && (ankle?.y ?? Infinity) <= 1 + edgeMargin);
  const head = landmarks[0];

  // Mirror the horizontal axis to match what the player sees on screen.
  const dispMinX = 1 - maxX;
  const dispMaxX = 1 - minX;

  if (!feetShown && (lowerBodyPoints.length < 3 || maxY > 1 - edgeMargin)) {
    return "Step back so your feet show";
  }
  if (visibleEnough(head) && head!.y < -edgeMargin) {
    return "Step back";
  }
  if (dispMaxX > 1 + edgeMargin) {
    return "Step left";
  }
  if (dispMinX < -edgeMargin) {
    return "Step right";
  }
  if (maxY - minY < minBodyHeight) {
    return "Step closer";
  }
  return null;
}

// Backdrop behind the wall (the hole reads as black, matching the running view).
const IDLE_BACKDROP = "#000000";

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

export function AthleteStage({
  targetPose,
  poseOptions,
  savedPoseIds,
  selectedPoseId,
  onSelectPose,
  powerupActivation,
  onFinishWall,
  playingSessionKey,
  onAllLivesLost,
  capturePosePool,
  onCaptureShot,
  onRoundCapture
}: AthleteStageProps) {
  const tempo = useGameTempo();
  const { beginDefeatSequence } = useDefeatSequence();
  const { stopSoundtrack } = useSound();
  const { playSoundEffect, playSoundEffectWithEnded } = useRoleScopedSound(GameRole.Dummy);
  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scoreTargetRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopLoopRef = useRef<(() => void) | null>(null);
  const lastMatchUpdate = useRef(0);
  const scoreFlightIdRef = useRef(0);
  const scoreFlightTimersRef = useRef<number[]>([]);

  // Tempo phase drives the dummy's behavior: rest = dim + wait, pose = track/score,
  // snapshot = freeze + score. The detect loop reads it through a ref.
  const tempoPhase = tempo?.phase ?? null;
  const tempoPhaseRef = useRef(tempoPhase);
  tempoPhaseRef.current = tempoPhase;
  const lastSnapshotCycleRef = useRef<number | null>(null);
  /** Latched at count 5 each cycle; used for hole draw + scoring on beats 5–8. */
  const visibleHoleRef = useRef<UniversalPose | null>(null);
  const lastHoleLatchCycleRef = useRef<number | null>(null);

  // The dummy is rendered on a separate p5.js WEBGL canvas overlaid on the 2D one. The
  // detect loop publishes the latest pose here and the p5 draw loop reads it.
  const dummyMountRef = useRef<HTMLDivElement>(null);
  const dummyRenderRef = useRef<DummyRender | null>(null);

  // Keep the latest target in a ref so the running detect loop always sees fresh data
  // without us tearing down and rebuilding the loop on every prop change.
  const targetRef = useRef(targetPose);
  targetRef.current = targetPose;

  const [status, setStatus] = useState("Starting…");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(false);
  const [matchPercent, setMatchPercent] = useState(0);
  const [band, setBand] = useState<ScoreBand>("CRASH");
  const [score, setScore] = useState(0);
  const [scoreFlights, setScoreFlights] = useState<ScoreFlight[]>([]);
  const [lives, setLives] = useState(STARTING_LIVES);
  const livesRef = useRef(STARTING_LIVES);
  const defeatedRef = useRef(false);
  const lastLifeLossCycleRef = useRef<number | null>(null);
  const onAllLivesLostRef = useRef(onAllLivesLost);
  onAllLivesLostRef.current = onAllLivesLost;
  const onCaptureShotRef = useRef(onCaptureShot);
  onCaptureShotRef.current = onCaptureShot;
  const onRoundCaptureRef = useRef(onRoundCapture);
  onRoundCaptureRef.current = onRoundCapture;
  const [showDummy, setShowDummy] = useState(true);
  const [showDebugDashboard, setShowDebugDashboard] = useState(false);
  const [guidance, setGuidance] = useState<string | null>(null);
  const [showGameOverOverlay, setShowGameOverOverlay] = useState(false);
  const [debugInfo, setDebugInfo] = useState<PoseDebugInfo | null>(null);
  // Dev mode comes from the global Settings menu now. When on, the game never pauses for
  // framing, and the athlete dev controls (pose picker etc.) appear in the Settings dropdown.
  const { devMode } = useSettings();
  const { invincibleMode } = useEffectiveDevGameplay();
  const lastHandUpdate = useRef(0);
  const lastSpotlightUpdate = useRef(0);
  const lastDebugUpdate = useRef(0);
  const powerupTimerRef = useRef<number | null>(null);
  const [activePowerup, setActivePowerup] = useState<SaboteurPowerupKind | null>(null);
  const [spotlightPct, setSpotlightPct] = useState({ x: 50, y: 55 });
  const matchPercentRef = useRef(0);
  const runningRef = useRef(false);
  const bandRef = useRef<ScoreBand>("CRASH");
  const guidanceRef = useRef<string | null>(null);
  matchPercentRef.current = matchPercent;
  livesRef.current = lives;
  runningRef.current = running;
  bandRef.current = band;
  guidanceRef.current = guidance;
  const debugInfoRef = useRef<PoseDebugInfo | null>(null);
  debugInfoRef.current = debugInfo;

  // The render loop reads these through refs so toggling doesn't rebuild the loop.
  const showDummyRef = useRef(showDummy);
  showDummyRef.current = showDummy;
  const devModeRef = useRef(devMode);
  devModeRef.current = devMode;
  const invincibleModeRef = useRef(invincibleMode);
  invincibleModeRef.current = invincibleMode;
  const showDebugDashboardRef = useRef(showDebugDashboard);
  showDebugDashboardRef.current = showDebugDashboard;
  const activePowerupRef = useRef(activePowerup);
  activePowerupRef.current = activePowerup;

  const spawnScoreFlight = useCallback((points: number) => {
    const stage = stageRef.current;
    const target = scoreTargetRef.current;
    if (!stage || !target) {
      return;
    }

    const stageRect = stage.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const from = scoreSpawnPoint(stageRect, canvasRef.current, dummyRenderRef.current?.pose ?? null);
    const to = {
      x: targetRect.left - stageRect.left + targetRect.width * 0.5,
      y: targetRect.top - stageRect.top + targetRect.height * 0.52
    };
    const mid = {
      x: (from.x + to.x) / 2 + randomBetween(-150, 130),
      y: Math.min(from.y, to.y) - randomBetween(90, 190)
    };
    const duration = SCORE_FLIGHT_MS + Math.round(randomBetween(-110, 130));
    const flight: ScoreFlight = {
      id: ++scoreFlightIdRef.current,
      points,
      from,
      mid,
      to,
      rotate: randomBetween(-18, 18),
      duration
    };

    setScoreFlights((current) => [...current.slice(-5), flight]);
    const timerId = window.setTimeout(() => {
      setScoreFlights((current) => current.filter((item) => item.id !== flight.id));
      scoreFlightTimersRef.current = scoreFlightTimersRef.current.filter((item) => item !== timerId);
    }, duration + SCORE_FLIGHT_PRUNE_MS);
    scoreFlightTimersRef.current.push(timerId);
  }, []);

  const awardCurrentScore = useCallback(() => {
    if (!runningRef.current || (guidanceRef.current && !devModeRef.current)) {
      return;
    }

    const points = Math.max(0, Math.round(matchPercentRef.current));
    if (points <= 0) {
      return;
    }

    setScore((current) => current + points);
    spawnScoreFlight(points);
  }, [spawnScoreFlight]);

  const stop = useCallback(() => {
    const wasActive = Boolean(stopLoopRef.current || streamRef.current);
    stopLoopRef.current?.();
    stopLoopRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    dummyRenderRef.current = null;
    if (wasActive) {
      setRunning(false);
      setStatus("Stopped");
      setGuidance(null);
      setDebugInfo(null);
    }
  }, []);

  useEffect(() => stop, [stop]);

  useEffect(() => {
    if (!devMode || !showDebugDashboard) {
      setDebugInfo(null);
    }
  }, [devMode, showDebugDashboard]);

  useEffect(
    () => () => {
      if (powerupTimerRef.current) {
        window.clearTimeout(powerupTimerRef.current);
      }
      scoreFlightTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      scoreFlightTimersRef.current = [];
    },
    []
  );

  useEffect(() => {
    if (!playingSessionKey) {
      return;
    }

    setLives(STARTING_LIVES);
    livesRef.current = STARTING_LIVES;
    defeatedRef.current = false;
    lastLifeLossCycleRef.current = null;
    visibleHoleRef.current = null;
    lastHoleLatchCycleRef.current = null;
  }, [playingSessionKey]);

  useEffect(() => {
    if (!powerupActivation) {
      return;
    }

    const duration = powerupActivation.durationMs ?? DEFAULT_POWERUP_DURATION_MS;
    setActivePowerup(powerupActivation.kind);
    playSoundEffect(POWERUP_SFX[powerupActivation.kind]);
    if (powerupTimerRef.current) {
      window.clearTimeout(powerupTimerRef.current);
    }
    powerupTimerRef.current = window.setTimeout(() => setActivePowerup(null), duration);
  }, [playSoundEffect, powerupActivation]);

  const getScoringHoleTarget = useCallback(() => {
    return visibleHoleRef.current ?? targetRef.current;
  }, []);

  const buildCapture = useCallback(() => {
    return buildRoundCaptureImages(
      videoRef.current,
      getScoringHoleTarget(),
      matchPercentRef.current
    );
  }, [getScoringHoleTarget]);

  const getSnapshotMatchPercent = useCallback(() => {
    const pose = dummyRenderRef.current?.pose;
    if (pose) {
      return comparePoses(pose, getScoringHoleTarget());
    }

    return matchPercentRef.current;
  }, [getScoringHoleTarget]);

  const finishWall = useCallback(() => {
    const judgedMatch = getSnapshotMatchPercent();
    const judgedBand = scoreBandFromMatch(judgedMatch);
    matchPercentRef.current = judgedMatch;
    bandRef.current = judgedBand;
    setMatchPercent(judgedMatch);
    setBand(judgedBand);

    awardCurrentScore();
    onFinishWall?.({
      matchPercent: judgedMatch,
      band: judgedBand,
      sentAt: new Date().toISOString()
    });

    const roundCapture = buildCapture();
    if (roundCapture) {
      onRoundCaptureRef.current?.(roundCapture);
    }

    if (defeatedRef.current) {
      return;
    }

    if (judgedBand !== "CRASH" || invincibleModeRef.current) {
      return;
    }

    const cycleKey = tempo?.cycle ?? null;
    if (cycleKey !== null && lastLifeLossCycleRef.current === cycleKey) {
      return;
    }

    if (cycleKey !== null) {
      lastLifeLossCycleRef.current = cycleKey;
    }

    const nextLives = livesRef.current - 1;
    livesRef.current = nextLives;
    setLives(nextLives);
    playSoundEffect("healthChip");

    if (nextLives > 0) {
      return;
    }

    defeatedRef.current = true;
    beginDefeatSequence();
    setShowGameOverOverlay(true);
    stopSoundtrack();
    playSoundEffectWithEnded("death", () => {
      playSoundEffectWithEnded("gameOver", () => {
        onAllLivesLostRef.current?.();
      });
    });
  }, [
    awardCurrentScore,
    beginDefeatSequence,
    buildCapture,
    getSnapshotMatchPercent,
    onFinishWall,
    playSoundEffect,
    playSoundEffectWithEnded,
    stopSoundtrack,
    tempo
  ]);

  // Latch hole at count 5; hide at count 1 of each cycle.
  useLayoutEffect(() => {
    if (!tempo) {
      return;
    }

    if (tempo.count === 1 && tempo.phase === "rest") {
      visibleHoleRef.current = null;
      return;
    }

    if (tempo.count === 5 && tempo.cycle !== lastHoleLatchCycleRef.current) {
      lastHoleLatchCycleRef.current = tempo.cycle;
      visibleHoleRef.current = targetRef.current;
    }
  }, [tempo?.count, tempo?.phase, tempo?.cycle]);

  // Count 8: judge the frozen dummy pose and drop a life on CRASH — before paint.
  useLayoutEffect(() => {
    if (!tempo || tempo.count !== 8 || tempo.phase !== "snapshot") {
      return;
    }

    if (tempo.cycle === lastSnapshotCycleRef.current) {
      return;
    }

    lastSnapshotCycleRef.current = tempo.cycle;
    finishWall();
  }, [tempo?.count, tempo?.phase, tempo?.cycle, finishWall]);

  // Spin up the p5.js WEBGL canvas that renders the 3D dummy on top of the 2D hole. The
  // canvas mirrors the 2D canvas's resolution + CSS so the dummy lines up with the hole.
  useEffect(() => {
    let sketch: p5 | undefined;
    let cancelled = false;

    void import("p5").then((module) => {
      if (cancelled || !dummyMountRef.current) {
        return;
      }
      const P5 = module.default;
      sketch = new P5((p: p5) => {
        p.setup = () => {
          const source = canvasRef.current;
          p.createCanvas(source?.width || 1280, source?.height || 720, p.WEBGL);
          syncDummyCanvasCss(dummyMountRef.current);
          p.noStroke();
        };
        p.draw = () => {
          // Keep the 3D canvas matched to the 2D canvas's resolution so they stay aligned.
          const source = canvasRef.current;
          if (source && (source.width !== p.width || source.height !== p.height)) {
            p.resizeCanvas(source.width, source.height);
          }
          syncDummyCanvasCss(dummyMountRef.current);
          p.clear();
          const data = dummyRenderRef.current;
          if (!data || !showDummyRef.current) {
            return;
          }
          // A bad draw frame must never permanently freeze the 3D dummy; recover next frame.
          try {
            drawDummy3D(p, data.pose, data.handClosed, p.width, p.height);
          } catch (err) {
            console.error("dummy draw error (continuing)", err);
          }
        };
      }, dummyMountRef.current);
    });

    return () => {
      cancelled = true;
      sketch?.remove();
    };
  }, []);

  // Auto-start pose detection on mount instead of waiting for a button. Guarded with a
  // ref so React StrictMode's double-invoke (and re-renders) don't kick off twice.
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (autoStartedRef.current) {
      return;
    }
    autoStartedRef.current = true;
    void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setError(false);
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

          // Map the live body onto the universal dummy (mirrored to match the selfie view),
          // then retarget it onto the target hole's exact bone lengths so the figure size is
          // proportion-independent. The player's real frame position drives where the dummy
          // sits, so the SAME pose drives both the drawn dummy and the score.
          const aspect = (video.videoWidth || 16) / (video.videoHeight || 9);
          const live = landmarks
            ? landmarksToUniversalPose(landmarks, aspect, { mirror: true, minVisibility: 0.3 })
            : null;

          // Player's raw (un-mirrored) hip-center in frame units, used to place the dummy
          // at the player's actual horizontal location within the hole.
          const lHip = landmarks?.[23];
          const rHip = landmarks?.[24];
          const hipFrameX = lHip && rHip ? (lHip.x + rHip.x) / 2 : null;

          // Always retarget onto the hole's bone lengths before positioning. Dev mode only
          // affects UI guidance; it must not change the geometry used for rendering/scoring.
          const phase = tempoPhaseRef.current;
          const holeTarget = !phase
            ? targetRef.current
            : isHoleVisiblePhase(phase)
              ? visibleHoleRef.current
              : null;
          const scoringTarget = visibleHoleRef.current ?? targetRef.current;

          let dummyPose: UniversalPose | null = null;
          let bodyPose: UniversalPose | null = null;
          if (live) {
            bodyPose = retargetPose(live, scoringTarget);
            dummyPose =
              hipFrameX !== null && ctx
                ? anchorDummyToPlayer(bodyPose, scoringTarget, hipFrameX, ctx.canvas.width, ctx.canvas.height)
                : bodyPose;
          }

          // Tempo gating: on the "snapshot" beat the dummy + score freeze (hold the last
          // pose-phase frame); scoring only runs during the "pose" beats. No tempo (e.g.
          // standalone/dev) = everything runs normally.
          const frozen = phase === "snapshot";
          const scoring = !phase || phase === "pose";

          // Publish the pose for the p5 WEBGL dummy, and paint the 2D backdrop + hole.
          if (!frozen) {
            dummyRenderRef.current = dummyPose ? { pose: dummyPose, handClosed } : null;
          }
          if (ctx) {
            drawFrame(ctx, holeTarget);
          }

          const now = performance.now();
          if (now - lastHandUpdate.current > 120) {
            lastHandUpdate.current = now;
            setGuidance(devModeRef.current ? null : frameGuidance(landmarks));
          }

          if (devModeRef.current && showDebugDashboardRef.current && ctx && now - lastDebugUpdate.current > 120) {
            lastDebugUpdate.current = now;
            setDebugInfo(
              buildPoseDebugInfo(
                ctx.canvas,
                dummyMountRef.current,
                hipFrameX,
                bodyPose,
                dummyPose,
                scoringTarget
              )
            );
          }

          if (dummyPose && scoring && now - lastMatchUpdate.current > 120) {
            lastMatchUpdate.current = now;
            // Score the same positioned body that is rendered: percent of dummy silhouette
            // inside the visible hole, so horizontal drift tanks the meter naturally.
            const percent = comparePoses(dummyPose, scoringTarget);
            setMatchPercent(percent);
            setBand(scoreBandFromMatch(percent));
          }

          if (activePowerupRef.current === "blindness" && lHip && rHip && now - lastSpotlightUpdate.current > 50) {
            lastSpotlightUpdate.current = now;
            setSpotlightPct({
              x: (1 - (lHip.x + rHip.x) / 2) * 100,
              y: ((lHip.y + rHip.y) / 2) * 100
            });
          }
        },
        handLandmarker
      );
    } catch (err) {
      setStatus(`Error: ${(err as Error).message}`);
      setError(true);
      stop();
    }
  }

  // Stable wrappers so the registered dev-section node doesn't churn on the ~8/s match
  // re-renders (the underlying functions are recreated every render).
  const startRef = useRef<() => void>(() => {});
  startRef.current = () => void start();
  const finishWallRef = useRef<() => void>(() => {});
  finishWallRef.current = () => finishWall();
  const handleStart = useCallback(() => startRef.current(), []);
  const handleFinishWall = useCallback(() => finishWallRef.current(), []);
  const handleLogDebugSnapshot = useCallback(() => {
    console.info("pose alignment debug", debugInfoRef.current);
  }, []);

  const handleCaptureShot = useCallback(() => {
    const pool = capturePosePool ?? poseOptions ?? [targetRef.current];
    const capture = buildGameCaptureImages(videoRef.current, pool, matchPercentRef.current);
    if (capture) {
      onCaptureShotRef.current?.(capture);
      return;
    }

    showGameNotice("Start the camera before taking a capture shot.");
  }, [capturePosePool, poseOptions]);

  // Athlete dev controls live in the global Settings menu (under Dev Mode).
  const athleteDevSection = useMemo(
    () => (
      <div className="flex flex-col gap-3">
        <span className="text-[11px] font-extrabold tracking-[0.12em] text-[#a89a82] uppercase">Athlete</span>
        <p className="m-0 text-sm font-bold text-[#e08a17]">{status}</p>
        {poseOptions && poseOptions.length > 0 ? (
          <PoseMenu
            poseOptions={poseOptions}
            savedPoseIds={savedPoseIds}
            selectedPoseId={selectedPoseId}
            onSelectPose={onSelectPose}
          />
        ) : null}
        <div className="flex flex-col gap-2">
          {running ? (
            <button className={pillSecondary} type="button" onClick={stop}>
              Stop
            </button>
          ) : (
            <button className={pillPrimary} type="button" onClick={handleStart}>
              Start Pose Detection
            </button>
          )}
          <button
            className={pillSecondary}
            type="button"
            aria-pressed={showDummy}
            onClick={() => setShowDummy((on) => !on)}
          >
            Dummy Overlay: {showDummy ? "On" : "Off"}
          </button>
          <SettingsToggle
            id="athlete-debug-dashboard"
            label="Debug Dashboard"
            description="Alignment lines and metrics"
            checked={showDebugDashboard}
            onCheckedChange={setShowDebugDashboard}
          />
          <button className={pillSecondary} type="button" onClick={handleFinishWall}>
            Finish Wall
          </button>
          <button className={pillSecondary} type="button" onClick={handleLogDebugSnapshot}>
            Log Debug Snapshot
          </button>
          <button className={pillSecondary} type="button" onClick={handleCaptureShot}>
            Capture shot
          </button>
        </div>
      </div>
    ),
    [
      status,
      running,
      showDummy,
      poseOptions,
      savedPoseIds,
      selectedPoseId,
      onSelectPose,
      handleStart,
      handleFinishWall,
      handleLogDebugSnapshot,
      handleCaptureShot,
      showDebugDashboard,
      stop
    ]
  );
  useDevSection("athlete", athleteDevSection);

  const matchColor = BAND_COLOR[band];
  const debugDashboardVisible = devMode && showDebugDashboard;

  return (
    <div ref={stageRef} className="fixed inset-0 z-40 overflow-hidden bg-[#05080c]">
      <video ref={videoRef} muted playsInline className="pointer-events-none absolute size-px opacity-0" />
      <div className={cx("relative h-full w-full", activePowerup === "mirror" && "scale-x-[-1]")}>
        <canvas ref={canvasRef} width={1280} height={720} className="block h-full w-full object-cover" />

        {/* 3D dummy renders here (p5.js WEBGL), overlaid on the 2D hole and matched to its
            resolution + object-cover so the dummy lines up with the carved hole. */}
        <div
          ref={dummyMountRef}
          className="pointer-events-none absolute inset-0 z-[1] [&>canvas]:absolute [&>canvas]:inset-0 [&>canvas]:block [&>canvas]:h-full [&>canvas]:w-full [&>canvas]:object-cover"
        />
        {debugDashboardVisible ? <PoseDebugGuide info={debugInfo} /> : null}
      </div>

      {debugDashboardVisible ? <PoseDebugPanel info={debugInfo} /> : null}

      {activePowerup === "blindness" ? (
        <div
          className="pointer-events-none absolute inset-0 z-45"
          style={{
            background: `radial-gradient(circle 130px at ${spotlightPct.x}% ${spotlightPct.y}%, transparent 0%, transparent 42%, rgba(0,0,0,0.88) 62%, #000 100%)`
          }}
        />
      ) : null}

      {activePowerup === "mirror" ? (
        <div className="absolute top-6 left-1/2 z-46 -translate-x-1/2 rounded-full border border-[#64b4ff]/50 bg-[#64b4ff]/20 px-3 py-1 text-xs font-extrabold tracking-widest text-white uppercase">
          Mirror Mode
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-0 z-47 overflow-hidden" aria-hidden="true">
        {scoreFlights.map((flight) => (
          <ScoreFlightChip flight={flight} key={flight.id} />
        ))}
      </div>

      {/* Top-left stack: logo and score. */}
      <div className="absolute top-4 left-4 z-42 flex w-[214px] flex-col gap-3">
        <img
          src="/poses-for-dummies-logo-ai.png"
          alt="Poses for Dummies"
          className="w-[200px] select-none filter-[drop-shadow(0_2px_1px_rgba(0,0,0,0.22))_drop-shadow(0_9px_14px_rgba(80,55,0,0.45))]"
          draggable={false}
        />
        <div className={cx(hudCard, "px-4 py-2.5")}>
          <span className={hudLabel}>Score</span>
          <div ref={scoreTargetRef} className="mt-0.5 flex items-center gap-2">
            <StarIcon />
            <span className="text-[28px] font-black leading-none text-[#2b303b]">{score}</span>
          </div>
        </div>
      </div>

      {/* Match meter down the right side. */}
      <div className={cx(hudCard, "absolute top-1/2 right-5 z-42 flex h-[300px] w-[128px] -translate-y-1/2 flex-col items-center gap-2 px-4 py-4")}>
        <span className={hudLabel}>Match</span>
        <span className="text-[26px] font-black leading-none" style={{ color: matchColor }}>
          {matchPercent}%
        </span>
        <div className="relative w-[72px] flex-1 overflow-hidden rounded-full bg-[#ece0c2] shadow-[inset_0_2px_6px_rgba(120,90,20,0.25)]">
          <div
            className="absolute inset-x-0 bottom-0 rounded-full transition-[height,background] duration-200 ease-linear"
            style={{ height: `${matchPercent}%`, background: matchColor }}
          />
        </div>
      </div>

      {/* Lives: filled hearts only; rightmost unmounts when a life is lost. */}
      <div className="absolute bottom-6 left-6 z-42 flex min-w-[10.5rem] items-center gap-2">
        {Array.from({ length: STARTING_LIVES }).map((_, index) =>
          index < lives ? <HeartIcon key={index} filled /> : null
        )}
      </div>

      {showGameOverOverlay ? (
        <div className="pointer-events-none absolute inset-0 z-48 flex items-center justify-center bg-[#04070b] text-center">
          <span className="px-6 text-[clamp(2.5rem,8vw,6rem)] font-black tracking-[0.04em] text-[#fdf6e8] [text-shadow:0_2px_24px_rgba(0,0,0,0.75)]">
            GAME OVER
          </span>
        </div>
      ) : null}

      {/* Out-of-frame guidance: dims the screen and pauses with big instructions. */}
      {running && guidance && (
        <div className="pointer-events-none absolute inset-0 z-44 flex flex-col items-center justify-center gap-5 bg-[#04070b] text-center text-[#ffd65c]">
          <span
            className="text-[clamp(4rem,12vw,9rem)] leading-none text-white/92 [text-shadow:0_0_24px_rgba(0,0,0,0.6)]"
            aria-hidden="true"
          >
            ⏸
          </span>
          <span className="px-6 text-[clamp(2.2rem,6vw,4.5rem)] font-black tracking-[0.01em] [text-shadow:0_2px_18px_rgba(0,0,0,0.7)]">{guidance}</span>
        </div>
      )}

      {/* Tempo rest phase (counts 1-4): dim the stage and tell the dummy to wait. The pose
          is revealed when this lifts at count 5. */}
      {running && tempoPhase === "rest" && (
        <div className="pointer-events-none absolute inset-0 z-44 flex flex-col items-center justify-center gap-3 bg-[#05080c] text-center">
          <span className="text-sm font-extrabold tracking-[0.2em] text-[#ffd65c] uppercase">Rest</span>
          <span className="px-6 text-[clamp(1.8rem,5vw,3.2rem)] font-black text-white [text-shadow:0_2px_18px_rgba(0,0,0,0.7)]">
            Wait for the saboteur…
          </span>
        </div>
      )}

      {/* Fullscreen toggle, bottom-right circular button. */}
      <button
        type="button"
        className="absolute right-6 bottom-6 z-43 grid size-14 cursor-pointer place-items-center rounded-full bg-[#fdf6e8] shadow-[inset_0_1.5px_0_rgba(255,255,255,0.95),0_2px_3px_rgba(0,0,0,0.16),0_10px_20px_rgba(70,50,0,0.32)] transition-transform active:translate-y-px"
        aria-label="Toggle fullscreen"
        onClick={() => toggleFullscreen(canvasRef.current?.parentElement ?? null)}
      >
        <FullscreenIcon />
      </button>

      {/* While loading (before tracking starts): spinner centered over the hole. On a
          camera/model error: a short message with a retry button. */}
      {!running && (
        <div className="absolute inset-0 z-41 grid place-items-center">
          {error ? (
            <div className={cx(hudCard, "flex max-w-[300px] flex-col items-center gap-3 px-6 py-5 text-center")}>
              <span className="text-base font-extrabold text-[#2b303b]">Couldn't start the camera</span>
              <span className="text-sm font-semibold text-[#a89a82]">Check camera permissions and try again.</span>
              <button className={cx(pillPrimary, "px-6 py-3")} type="button" onClick={() => void start()}>
                Try again
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <span className="size-16 animate-spin rounded-full border-4 border-[#fdf6e8]/40 border-t-[#ffc83d]" />
              <span className="rounded-full bg-[#fdf6e8]/90 px-4 py-1.5 text-sm font-extrabold text-[#2b303b] shadow-[0_4px_12px_rgba(80,55,0,0.18)]">
                {status}
              </span>
            </div>
          )}
        </div>
      )}

    </div>
  );
}

function ScoreFlightChip({ flight }: { flight: ScoreFlight }) {
  const style = {
    left: `${flight.from.x}px`,
    top: `${flight.from.y}px`,
    "--score-mid-x": `${flight.mid.x - flight.from.x}px`,
    "--score-mid-y": `${flight.mid.y - flight.from.y}px`,
    "--score-end-x": `${flight.to.x - flight.from.x}px`,
    "--score-end-y": `${flight.to.y - flight.from.y}px`,
    "--score-rotate": `${flight.rotate}deg`,
    animationDuration: `${flight.duration}ms`
  } as CSSProperties;

  return (
    <div className="score-flight-chip" style={style}>
      <span>+{flight.points}</span>
    </div>
  );
}

function debugValue(value: number | null | undefined, digits = 3) {
  return value === null || value === undefined || !Number.isFinite(value) ? "..." : value.toFixed(digits);
}

function debugPixels(value: number | null | undefined) {
  return value === null || value === undefined || !Number.isFinite(value) ? "..." : `${Math.round(value)}px`;
}

function DebugLine({
  pct,
  color,
  label,
  dashed = false
}: {
  pct: number | null;
  color: string;
  label: string;
  dashed?: boolean;
}) {
  if (pct === null || !Number.isFinite(pct)) {
    return null;
  }

  return (
    <div
      className={cx(
        "absolute top-0 bottom-0 z-10 w-0 border-l-2",
        dashed && "border-dashed"
      )}
      style={{ left: `${pct}%`, borderColor: color }}
    >
      <span
        className="absolute top-2 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-black whitespace-nowrap uppercase text-white"
        style={{ color }}
      >
        {label}
      </span>
    </div>
  );
}

function PoseDebugGuide({ info }: { info: PoseDebugInfo | null }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-40">
      <DebugLine pct={50} color="rgba(255,255,255,0.78)" label="stage 50%" dashed />
      {info ? (
        <>
          <DebugLine pct={info.linePct.holeCenter} color="#ffd84d" label="hole center" dashed />
          <DebugLine pct={info.linePct.targetHip} color="#ff65c8" label="target hips" />
          <DebugLine pct={info.linePct.measuredHip} color="#62e6ff" label="mp hips" />
          <DebugLine pct={info.linePct.dummyHip} color="#57ff77" label="dummy hips" />
        </>
      ) : null}
    </div>
  );
}

function DebugRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-white/58">{label}</span>
      <span className="font-black text-white">{value}</span>
    </div>
  );
}

function PoseDebugPanel({ info }: { info: PoseDebugInfo | null }) {
  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-50 w-[min(680px,calc(100%-2rem))] -translate-x-1/2 rounded-xl border border-white/20 bg-black/72 px-4 py-3 font-mono text-[11px] text-white shadow-[0_12px_32px_rgba(0,0,0,0.38)] backdrop-blur">
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-black uppercase tracking-[0.12em]">
        <span className="text-[#57ff77]">Pose Alignment Debug</span>
        <span className="text-[#62e6ff]">cyan: MediaPipe hips</span>
        <span className="text-[#57ff77]">green: dummy hips</span>
        <span className="text-[#ff65c8]">pink: target hips</span>
      </div>

      {info ? (
        <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          <DebugRow label="raw hip x" value={debugValue(info.rawHipX)} />
          <DebugRow label="mirrored hip x" value={debugValue(info.mirroredHipX)} />
          <DebugRow label="player box x" value={debugValue(info.playerBoxX)} />
          <DebugRow label="pre-anchor hip x" value={debugValue(info.preAnchorHipX)} />
          <DebugRow label="dummy hip x" value={debugValue(info.dummyHipX)} />
          <DebugRow label="target hip x" value={debugValue(info.targetHipX)} />
          <DebugRow label="anchor dx box" value={debugValue(info.dxBox)} />
          <DebugRow label="mp hip vs center" value={debugPixels(info.deltas.measuredMinusCenter)} />
          <DebugRow label="dummy vs mp hip" value={debugPixels(info.deltas.dummyMinusMeasured)} />
          <DebugRow label="dummy vs hole" value={debugPixels(info.deltas.dummyMinusHoleCenter)} />
          <DebugRow label="2d canvas" value={`${Math.round(info.canvas.css.width)}x${Math.round(info.canvas.css.height)}`} />
          <DebugRow
            label="p5 delta"
            value={
              info.p5Canvas
                ? `${debugPixels(info.p5Canvas.deltaLeft)}, ${debugPixels(info.p5Canvas.deltaWidth)}w`
                : "..."
            }
          />
        </div>
      ) : (
        <div className="text-white/70">Waiting for pose frames...</div>
      )}
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
      className={pose.id === selectedPoseId ? pillPrimary : pillSecondary}
      onClick={() => onSelectPose?.(pose)}
    >
      {pose.name}
    </button>
  );

  return (
    <>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold uppercase text-[#a89a82]">Starter holes</span>
        <div className="flex flex-col gap-2">{starters.map(renderButton)}</div>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-bold uppercase text-[#a89a82]">Saboteur holes</span>
        {saboteurPoses.length > 0 ? (
          <div className="flex flex-col gap-2">{saboteurPoses.map(renderButton)}</div>
        ) : (
          <p className="m-0 text-sm leading-5 text-[#8a7d66]">
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

/** Latest data published by the detect loop for the p5 WEBGL dummy to render. */
type DummyRender = { pose: UniversalPose; handClosed: HandClosed };

/**
 * Draw one live frame on the 2D canvas: black backdrop + the carved hole. The blue dummy
 * is rendered separately in 3D on the overlaid p5.js WEBGL canvas.
 */
function drawFrame(ctx: CanvasRenderingContext2D, target: UniversalPose | null) {
  const { width, height } = ctx.canvas;

  ctx.clearRect(0, 0, width, height);
  // Solid black backdrop instead of the live camera, so the hole reads as black.
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);

  if (!target) {
    return;
  }

  // Hole is carved from the same blob silhouette the saboteur draws. The live pose is
  // already mirrored to match the selfie view, so no extra canvas mirror is needed.
  drawHoleOverlay(ctx, target, width, height);
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
 * Render the athlete's dummy in 3D via the shared blob renderer. The pose already carries
 * the player's real position (anchored horizontally under them and planted on the floor),
 * so we just map the universal box straight into the centered portrait hole region.
 */
function drawDummy3D(
  p: p5,
  pose: UniversalPose,
  handClosed: HandClosed,
  width: number,
  height: number
) {
  const region = holeRegion(width, height);
  // Uniform universal-box-pixel → screen-pixel scale (region preserves the box aspect).
  const s = region.w / UNIVERSAL_W;

  const map = new Map(pose.joints.map((joint) => [joint.name, joint] as const));
  const at = (name: UniversalPose["joints"][number]["name"]): ScreenPoint | null => {
    const joint = map.get(name);
    return joint
      ? { x: region.x0 + joint.x * region.w, y: region.y0 + joint.y * region.h }
      : null;
  };

  drawDummyScene3D(p, { at, s, width, height, handClosed, faceMode: "happy" });
}

/**
 * Solid bright-yellow wall with a human-shaped hole punched clear. The area AROUND the
 * pose is opaque; the pose silhouette is left blank so the live camera shows through
 * it (the "hole in the wall" the athlete fits into).
 */
function drawHoleOverlay(
  ctx: CanvasRenderingContext2D,
  target: UniversalPose,
  width: number,
  height: number
) {
  const region = holeRegion(width, height);

  // The hole is the blob silhouette (body inflated by HOLE_PADDING, no face) — the
  // exact same geometry the saboteur previews on their screen.
  const silhouette = buildBlobFigure(target.joints, { color: "#000", pad: HOLE_PADDING });

  // Everything below happens on the offscreen wall layer, so the only thing that
  // touches the main camera canvas is a plain source-over composite.
  const wallCtx = getWallCtx(width, height);

  // 1) Paint the wall with a soft vertical gradient so it reads as a lit 3D surface.
  const wallGrad = wallCtx.createLinearGradient(0, 0, 0, height);
  wallGrad.addColorStop(0, "#ffe24f");
  wallGrad.addColorStop(1, "#eaad00");
  wallCtx.fillStyle = wallGrad;
  wallCtx.fillRect(0, 0, width, height);

  // 2) Carve the figure silhouette clear (transparent = the hole). Rim/highlight passes
  //    were removed — shadowBlur bled into the cutout and read as a grey ghost overlay.
  wallCtx.save();
  wallCtx.globalCompositeOperation = "destination-out";
  withRegionTransform(wallCtx, region, () => paintFigure(wallCtx, silhouette));
  wallCtx.restore();

  // 3) Composite the holed wall over the camera: camera shows through the hole, solid
  //    color everywhere else.
  ctx.drawImage(wallCtx.canvas, 0, 0);
}
