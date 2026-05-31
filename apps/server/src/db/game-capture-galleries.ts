import { eq } from "drizzle-orm";
import type { AppendGameCaptureFrame, GameCaptureFrame, GameCaptureGallery } from "@quackhacks/shared";
import { getDatabase } from "./client.js";
import { gameCaptureGalleries } from "./schema.js";

type StoredFrame = {
  roundIndex: number;
  poseName: string;
  snapshotImage: string;
  screenshotImage: string;
  matchPercent: number;
  createdAt: string;
};

function stripDataUrlPrefix(dataUrl: string) {
  const comma = dataUrl.indexOf(",");
  return comma === -1 ? dataUrl : dataUrl.slice(comma + 1);
}

function toDataUrl(base64: string) {
  return `data:image/jpeg;base64,${base64}`;
}

function toStoredFrame(frame: AppendGameCaptureFrame, createdAt: string): StoredFrame {
  return {
    roundIndex: frame.roundIndex,
    poseName: frame.poseName,
    snapshotImage: stripDataUrlPrefix(frame.snapshotDataUrl),
    screenshotImage: stripDataUrlPrefix(frame.screenshotDataUrl),
    matchPercent: frame.matchPercent,
    createdAt
  };
}

function toPublicFrame(frame: StoredFrame): GameCaptureFrame {
  return {
    roundIndex: frame.roundIndex,
    poseName: frame.poseName,
    snapshotDataUrl: toDataUrl(frame.snapshotImage),
    screenshotDataUrl: toDataUrl(frame.screenshotImage),
    matchPercent: frame.matchPercent,
    createdAt: frame.createdAt
  };
}

function parseStoredFrames(raw: string): StoredFrame[] {
  try {
    const parsed = JSON.parse(raw) as StoredFrame[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function appendGalleryFrame(
  sessionKey: string,
  frame: AppendGameCaptureFrame
): Promise<GameCaptureGallery> {
  const now = new Date().toISOString();
  const storedFrame = toStoredFrame(frame, now);

  const [existing] = await getDatabase()
    .select({ framesJson: gameCaptureGalleries.framesJson })
    .from(gameCaptureGalleries)
    .where(eq(gameCaptureGalleries.sessionKey, sessionKey))
    .limit(1);

  const frames = existing ? parseStoredFrames(existing.framesJson) : [];
  frames.push(storedFrame);

  await getDatabase()
    .insert(gameCaptureGalleries)
    .values({
      sessionKey,
      framesJson: JSON.stringify(frames),
      updatedAt: now
    })
    .onConflictDoUpdate({
      target: gameCaptureGalleries.sessionKey,
      set: {
        framesJson: JSON.stringify(frames),
        updatedAt: now
      }
    });

  return {
    sessionKey,
    frames: frames.map(toPublicFrame),
    updatedAt: now
  };
}

export async function getCaptureGallery(sessionKey: string): Promise<GameCaptureGallery | null> {
  const [row] = await getDatabase()
    .select({
      sessionKey: gameCaptureGalleries.sessionKey,
      framesJson: gameCaptureGalleries.framesJson,
      updatedAt: gameCaptureGalleries.updatedAt
    })
    .from(gameCaptureGalleries)
    .where(eq(gameCaptureGalleries.sessionKey, sessionKey))
    .limit(1);

  if (!row) {
    return null;
  }

  const frames = parseStoredFrames(row.framesJson).map(toPublicFrame);
  if (frames.length === 0) {
    return null;
  }

  return {
    sessionKey: row.sessionKey,
    frames,
    updatedAt: row.updatedAt
  };
}
