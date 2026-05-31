import {
  HOLE_PADDING,
  buildBlobFigure,
  starterPoses,
  universalHumanSize,
  type FigurePrimitive,
  type GameCaptureGallery,
  type UniversalPose
} from "@quackhacks/shared";
import type { CreateGameCapture, GameCapture } from "@quackhacks/shared";
import { api } from "./api";

export const LAST_CAPTURE_SESSION_KEY = "quackhacks:lastCaptureSession";

const CAPTURE_FETCH_MS = 8_000;
const MAX_GALLERY_FRAMES = 40;

/** Survives SPA navigation even when sessionStorage fills up. */
const memoryGalleries = new Map<string, GameCaptureGallery>();

let stableSoloSessionKey: string | null = null;

/** One stable key for the whole run (fixes solo/dev mode generating a new key every frame). */
export function resolveCaptureSessionKey(
  gameId: string | null | undefined,
  playingStartedAt: string | null | undefined
): string {
  const fromGame = gameId ?? playingStartedAt;
  if (fromGame) {
    stableSoloSessionKey = fromGame;
    return fromGame;
  }

  if (!stableSoloSessionKey) {
    stableSoloSessionKey = `solo-${crypto.randomUUID()}`;
  }

  return stableSoloSessionKey;
}

export function resetCaptureSessionKey(gameSessionKey: string | null | undefined) {
  stableSoloSessionKey = gameSessionKey ?? null;
}

function galleryCacheKey(sessionKey: string) {
  return `quackhacks:captureGallery:${sessionKey}`;
}

function legacyCacheKey(sessionKey: string) {
  return `quackhacks:capture:${sessionKey}`;
}

function readGalleryFromStorage(sessionKey: string): GameCaptureGallery | null {
  try {
    const raw = sessionStorage.getItem(galleryCacheKey(sessionKey));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as GameCaptureGallery;
    return parsed.frames?.length ? parsed : null;
  } catch {
    return null;
  }
}

function readLegacyGallery(sessionKey: string): GameCaptureGallery | null {
  try {
    const legacyRaw = sessionStorage.getItem(legacyCacheKey(sessionKey));
    if (!legacyRaw) {
      return null;
    }

    const legacy = JSON.parse(legacyRaw) as GameCapture;
    if (!legacy.snapshotDataUrl || !legacy.screenshotDataUrl) {
      return null;
    }

    return {
      sessionKey,
      updatedAt: legacy.createdAt,
      frames: [
        {
          roundIndex: 1,
          poseName: "Final pose",
          snapshotDataUrl: legacy.snapshotDataUrl,
          screenshotDataUrl: legacy.screenshotDataUrl,
          matchPercent: legacy.matchPercent ?? 0,
          createdAt: legacy.createdAt
        }
      ]
    };
  } catch {
    return null;
  }
}

function mergeGalleries(
  ...candidates: Array<GameCaptureGallery | null | undefined>
): GameCaptureGallery | null {
  const sessionKey =
    candidates.find((gallery) => gallery?.sessionKey)?.sessionKey ?? null;
  if (!sessionKey) {
    return null;
  }

  const byRound = new Map<number, GameCaptureGallery["frames"][number]>();
  for (const gallery of candidates) {
    for (const frame of gallery?.frames ?? []) {
      byRound.set(frame.roundIndex, frame);
    }
  }

  const frames = [...byRound.values()].sort((a, b) => a.roundIndex - b.roundIndex);
  if (frames.length === 0) {
    return null;
  }

  return {
    sessionKey,
    frames,
    updatedAt: new Date().toISOString()
  };
}

/** Immediate read after save — avoids waiting on D1 when opening the score screen. */
export function readCachedGallery(sessionKey: string): GameCaptureGallery | null {
  const fromMemory = memoryGalleries.get(sessionKey);
  if (fromMemory?.frames.length) {
    return fromMemory;
  }

  const fromStorage = readGalleryFromStorage(sessionKey);
  if (fromStorage) {
    memoryGalleries.set(sessionKey, fromStorage);
    return fromStorage;
  }

  return readLegacyGallery(sessionKey);
}

export function cacheGalleryLocally(gallery: GameCaptureGallery) {
  const trimmed =
    gallery.frames.length > MAX_GALLERY_FRAMES
      ? { ...gallery, frames: gallery.frames.slice(-MAX_GALLERY_FRAMES) }
      : gallery;

  memoryGalleries.set(trimmed.sessionKey, trimmed);

  try {
    sessionStorage.setItem(galleryCacheKey(trimmed.sessionKey), JSON.stringify(trimmed));
  } catch (error) {
    console.warn("Capture gallery too large for sessionStorage; using in-memory cache", error);
  }
}

const CAPTURE_WIDTH = 480;
const CAPTURE_HEIGHT = 270;
const HOLE_ASPECT = universalHumanSize.width / universalHumanSize.height;
const HOLE_SCALE = 0.8;
const UNIVERSAL_W = universalHumanSize.width;
const UNIVERSAL_H = universalHumanSize.height;

type Region = { x0: number; y0: number; w: number; h: number };

export type GameCaptureImages = {
  snapshotDataUrl: string;
  screenshotDataUrl: string;
  matchPercent: number;
  poseName: string;
};

function holeRegion(width: number, height: number): Region {
  const h = height * HOLE_SCALE;
  const w = h * HOLE_ASPECT;
  return { x0: (width - w) / 2, y0: (height - h) / 2, w, h };
}

function withRegionTransform(ctx: CanvasRenderingContext2D, region: Region, draw: () => void) {
  ctx.save();
  ctx.translate(region.x0, region.y0);
  ctx.scale(region.w / UNIVERSAL_W, region.h / UNIVERSAL_H);
  draw();
  ctx.restore();
}

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

function drawHoleWall(ctx: CanvasRenderingContext2D, target: UniversalPose, width: number, height: number) {
  const region = holeRegion(width, height);
  const silhouette = buildBlobFigure(target.joints, { color: "#000", pad: HOLE_PADDING });

  const wall = document.createElement("canvas");
  wall.width = width;
  wall.height = height;
  const wallCtx = wall.getContext("2d");
  if (!wallCtx) {
    return;
  }

  const wallGrad = wallCtx.createLinearGradient(0, 0, 0, height);
  wallGrad.addColorStop(0, "#ffe24f");
  wallGrad.addColorStop(1, "#eaad00");
  wallCtx.fillStyle = wallGrad;
  wallCtx.fillRect(0, 0, width, height);

  wallCtx.save();
  wallCtx.globalCompositeOperation = "destination-out";
  withRegionTransform(wallCtx, region, () => paintFigure(wallCtx, silhouette));
  wallCtx.restore();

  ctx.drawImage(wall, 0, 0);
}

export function pickRandomPose(poses: UniversalPose[]): UniversalPose | null {
  const pool = poses.length > 0 ? poses : starterPoses;
  if (pool.length === 0) {
    return null;
  }

  return pool[Math.floor(Math.random() * pool.length)]!;
}

/** Mirror selfie view of the live webcam feed. */
export function captureWebcamFrame(
  video: HTMLVideoElement | null,
  options: { matchPercent?: number; poseName?: string } = {}
): string | null {
  if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth <= 0) {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = CAPTURE_WIDTH;
  canvas.height = CAPTURE_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }

  const videoWidth = video.videoWidth;
  const videoHeight = video.videoHeight;
  const scale = Math.max(CAPTURE_WIDTH / videoWidth, CAPTURE_HEIGHT / videoHeight);
  const drawWidth = videoWidth * scale;
  const drawHeight = videoHeight * scale;
  const drawX = (CAPTURE_WIDTH - drawWidth) / 2;
  const drawY = (CAPTURE_HEIGHT - drawHeight) / 2;

  ctx.save();
  ctx.translate(CAPTURE_WIDTH, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, videoWidth, videoHeight, drawX, drawY, drawWidth, drawHeight);
  ctx.restore();

  if (options.matchPercent !== undefined || options.poseName) {
    ctx.fillStyle = "rgba(5, 8, 12, 0.55)";
    ctx.fillRect(0, 0, CAPTURE_WIDTH, 56);
    ctx.fillStyle = "#fdf6e8";
    ctx.font = "800 28px Nunito, Inter, ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(options.poseName ?? "Webcam", 20, 36);
    if (options.matchPercent !== undefined) {
      ctx.font = "900 34px Nunito, Inter, ui-sans-serif, system-ui, sans-serif";
      ctx.fillStyle = options.matchPercent >= 70 ? "#2fb86b" : "#ef5c6b";
      ctx.fillText(`${Math.round(options.matchPercent)}% match`, CAPTURE_WIDTH - 220, 36);
    }
  }

  return canvas.toDataURL("image/jpeg", 0.84);
}

function renderPoseStageImage(pose: UniversalPose): string | null {
  const canvas = document.createElement("canvas");
  canvas.width = CAPTURE_WIDTH;
  canvas.height = CAPTURE_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, CAPTURE_WIDTH, CAPTURE_HEIGHT);
  drawHoleWall(ctx, pose, CAPTURE_WIDTH, CAPTURE_HEIGHT);

  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillRect(0, CAPTURE_HEIGHT - 48, CAPTURE_WIDTH, 48);
  ctx.fillStyle = "#fdf6e8";
  ctx.font = "800 22px Nunito, Inter, ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(pose.name, 20, CAPTURE_HEIGHT - 16);

  return canvas.toDataURL("image/jpeg", 0.84);
}

/** Webcam snapshot + in-game wall for the scored pose. */
export function buildRoundCaptureImages(
  video: HTMLVideoElement | null,
  holePose: UniversalPose,
  matchPercent: number
): GameCaptureImages | null {
  const snapshotDataUrl = captureWebcamFrame(video, { matchPercent, poseName: holePose.name });
  const screenshotDataUrl = renderPoseStageImage(holePose);

  if (!snapshotDataUrl || !screenshotDataUrl) {
    return null;
  }

  return {
    snapshotDataUrl,
    screenshotDataUrl,
    matchPercent,
    poseName: holePose.name
  };
}

/** Webcam snapshot + random in-game wall screenshot (dev test). */
export function buildGameCaptureImages(
  video: HTMLVideoElement | null,
  poses: UniversalPose[],
  matchPercent = 0
): GameCaptureImages | null {
  const pose = pickRandomPose(poses);
  if (!pose) {
    return null;
  }

  return buildRoundCaptureImages(video, pose, matchPercent);
}

export function rememberCaptureSession(sessionKey: string) {
  sessionStorage.setItem(LAST_CAPTURE_SESSION_KEY, sessionKey);
}

export function readRememberedCaptureSession() {
  return sessionStorage.getItem(LAST_CAPTURE_SESSION_KEY);
}

export function buildScorePath(winner: "dummy" | "saboteur", captureSession?: string | null) {
  const params = new URLSearchParams({ winner });
  const session = captureSession ?? readRememberedCaptureSession();
  if (session) {
    params.set("captureSession", session);
  }
  return `/score?${params.toString()}`;
}

export function appendCaptureFrameLocally(sessionKey: string, roundIndex: number, capture: GameCaptureImages) {
  const existing =
    memoryGalleries.get(sessionKey) ??
    readGalleryFromStorage(sessionKey) ??
    readLegacyGallery(sessionKey);
  const gallery: GameCaptureGallery = {
    sessionKey,
    updatedAt: new Date().toISOString(),
    frames: [
      ...(existing?.frames ?? []),
      {
        roundIndex,
        poseName: capture.poseName,
        snapshotDataUrl: capture.snapshotDataUrl,
        screenshotDataUrl: capture.screenshotDataUrl,
        matchPercent: capture.matchPercent,
        createdAt: new Date().toISOString()
      }
    ]
  };
  cacheGalleryLocally(gallery);
  return gallery;
}

export function appendCaptureFrame(sessionKey: string, roundIndex: number, capture: GameCaptureImages) {
  const gallery = appendCaptureFrameLocally(sessionKey, roundIndex, capture);
  void syncCaptureFrameRemote(sessionKey, roundIndex, capture).catch((error) => {
    console.warn("Could not sync capture frame", error);
  });
  return gallery;
}

async function syncCaptureFrameRemote(sessionKey: string, roundIndex: number, capture: GameCaptureImages) {
  const response = await api.api["game-captures"][":sessionKey"].frames.$post({
    param: { sessionKey },
    json: {
      roundIndex,
      poseName: capture.poseName,
      snapshotDataUrl: capture.snapshotDataUrl,
      screenshotDataUrl: capture.screenshotDataUrl,
      matchPercent: capture.matchPercent
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to sync capture frame (${response.status})`);
  }
}

/** @deprecated Legacy single-frame save. */
export async function saveGameCapture(input: CreateGameCapture) {
  appendCaptureFrameLocally(input.sessionKey, 1, {
    snapshotDataUrl: input.snapshotDataUrl,
    screenshotDataUrl: input.screenshotDataUrl,
    matchPercent: input.matchPercent ?? 0,
    poseName: "Final pose"
  });

  const response = await api.api["game-captures"].$post({ json: input });
  if (!response.ok) {
    throw new Error(`Failed to save game capture (${response.status})`);
  }

  return response.json();
}

async function fetchCaptureGalleryRemote(sessionKey: string): Promise<GameCaptureGallery | null> {
  const apiBase = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
  const url = `${apiBase}/api/game-captures/${encodeURIComponent(sessionKey)}/gallery`;

  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(CAPTURE_FETCH_MS) });
  } catch {
    return null;
  }

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to load capture gallery (${response.status})`);
  }

  const body = (await response.json()) as { gallery?: GameCaptureGallery };
  return body.gallery ?? null;
}

/** Session cache first, then D1 gallery (with timeout). Merges both sources. */
export async function loadCaptureGallery(sessionKey: string): Promise<GameCaptureGallery | null> {
  const cached = readCachedGallery(sessionKey);
  let remote: GameCaptureGallery | null = null;

  try {
    remote = await fetchCaptureGalleryRemote(sessionKey);
  } catch {
    remote = null;
  }

  const merged = mergeGalleries(cached, remote);
  if (merged) {
    cacheGalleryLocally(merged);
  }

  return merged;
}

/** @deprecated Use loadCaptureGallery. */
export async function loadGameCapture(sessionKey: string): Promise<GameCapture | null> {
  const gallery = await loadCaptureGallery(sessionKey);
  const frame = gallery?.frames.at(-1);
  if (!frame) {
    return null;
  }

  return {
    sessionKey,
    snapshotDataUrl: frame.snapshotDataUrl,
    screenshotDataUrl: frame.screenshotDataUrl,
    matchPercent: frame.matchPercent,
    createdAt: frame.createdAt
  };
}

/** @deprecated Use readCachedGallery. */
export function readCachedCapture(sessionKey: string): GameCapture | null {
  const gallery = readCachedGallery(sessionKey);
  const frame = gallery?.frames.at(-1);
  if (!frame) {
    return null;
  }

  return {
    sessionKey,
    snapshotDataUrl: frame.snapshotDataUrl,
    screenshotDataUrl: frame.screenshotDataUrl,
    matchPercent: frame.matchPercent,
    createdAt: frame.createdAt
  };
}

/** @deprecated Use cacheGalleryLocally via appendCaptureFrameLocally. */
export function cacheCaptureLocally(sessionKey: string, images: Omit<GameCaptureImages, "poseName">) {
  appendCaptureFrameLocally(sessionKey, 1, { ...images, poseName: "Final pose" });
}
