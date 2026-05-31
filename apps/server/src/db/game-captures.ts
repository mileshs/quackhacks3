import { eq } from "drizzle-orm";
import type { CreateGameCapture, GameCapture } from "@quackhacks/shared";
import { getDatabase } from "./client.js";
import { gameCaptures } from "./schema.js";

function stripDataUrlPrefix(dataUrl: string) {
  const comma = dataUrl.indexOf(",");
  return comma === -1 ? dataUrl : dataUrl.slice(comma + 1);
}

function toDataUrl(base64: string) {
  return `data:image/jpeg;base64,${base64}`;
}

export async function upsertGameCapture(input: CreateGameCapture): Promise<GameCapture> {
  const now = new Date().toISOString();
  const snapshotImage = stripDataUrlPrefix(input.snapshotDataUrl);
  const screenshotImage = stripDataUrlPrefix(input.screenshotDataUrl);

  await getDatabase()
    .insert(gameCaptures)
    .values({
      sessionKey: input.sessionKey,
      snapshotImage,
      screenshotImage,
      matchPercent: input.matchPercent ?? null,
      createdAt: now
    })
    .onConflictDoUpdate({
      target: gameCaptures.sessionKey,
      set: {
        snapshotImage,
        screenshotImage,
        matchPercent: input.matchPercent ?? null,
        createdAt: now
      }
    });

  return {
    sessionKey: input.sessionKey,
    snapshotDataUrl: toDataUrl(snapshotImage),
    screenshotDataUrl: toDataUrl(screenshotImage),
    matchPercent: input.matchPercent ?? null,
    createdAt: now
  };
}

export async function getGameCapture(sessionKey: string): Promise<GameCapture | null> {
  const [row] = await getDatabase()
    .select({
      sessionKey: gameCaptures.sessionKey,
      snapshotImage: gameCaptures.snapshotImage,
      screenshotImage: gameCaptures.screenshotImage,
      matchPercent: gameCaptures.matchPercent,
      createdAt: gameCaptures.createdAt
    })
    .from(gameCaptures)
    .where(eq(gameCaptures.sessionKey, sessionKey))
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    sessionKey: row.sessionKey,
    snapshotDataUrl: toDataUrl(row.snapshotImage),
    screenshotDataUrl: toDataUrl(row.screenshotImage),
    matchPercent: row.matchPercent,
    createdAt: row.createdAt
  };
}
