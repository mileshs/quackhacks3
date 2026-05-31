import { Hono } from "hono";
import { validator } from "hono/validator";
import {
  appendGameCaptureFrameSchema,
  createGameCaptureSchema,
  createLeaderboardEntrySchema,
  scoreBandFromMatch,
  scoreFromMatch,
  starterPoses
} from "@quackhacks/shared";
import { appendGalleryFrame, getCaptureGallery } from "./db/game-capture-galleries.js";
import { getGameCapture, upsertGameCapture } from "./db/game-captures.js";
import {
  countLeaderboardEntries,
  createLeaderboardEntry,
  getDatabaseBindingName,
  listLeaderboardEntries
} from "./db/leaderboard.js";

export const api = new Hono()
  .get("/health", async (c) => {
    const entries = await countLeaderboardEntries();

    return c.json({
      ok: true,
      service: "quackhacks-api",
      database: {
        binding: getDatabaseBindingName(),
        leaderboardEntries: entries
      },
      realtime: {
        websocket: "/ws",
        coordinator: "GlobalGame"
      }
    });
  })
  .get("/poses", (c) => c.json({ poses: starterPoses }))
  .get("/leaderboard", async (c) => c.json({ entries: await listLeaderboardEntries() }))
  .post(
    "/leaderboard",
    validator("json", (value, c) => {
      const parsed = createLeaderboardEntrySchema.safeParse(value);

      if (!parsed.success) {
        return c.json(
          {
            error: "Invalid leaderboard entry",
            issues: parsed.error.flatten()
          },
          400
        );
      }

      return parsed.data;
    }),
    async (c) => {
      const entry = await createLeaderboardEntry(c.req.valid("json"));

      return c.json({ entry }, 201);
    }
  )
  .get("/score-preview/:match", (c) => {
    const rawMatch = Number(c.req.param("match"));
    const match = Number.isFinite(rawMatch) ? rawMatch : 0;

    return c.json({
      match,
      points: scoreFromMatch(match),
      band: scoreBandFromMatch(match)
    });
  })
  .post(
    "/game-captures",
    validator("json", (value, c) => {
      const parsed = createGameCaptureSchema.safeParse(value);

      if (!parsed.success) {
        return c.json(
          {
            error: "Invalid game capture",
            issues: parsed.error.flatten()
          },
          400
        );
      }

      return parsed.data;
    }),
    async (c) => {
      const capture = await upsertGameCapture(c.req.valid("json"));
      return c.json({ capture }, 201);
    }
  )
  .get("/game-captures/:sessionKey", async (c) => {
    const sessionKey = c.req.param("sessionKey");
    const gallery = await getCaptureGallery(sessionKey);

    if (gallery) {
      return c.json({ gallery });
    }

    const capture = await getGameCapture(sessionKey);

    if (!capture) {
      return c.json({ error: "Capture not found" }, 404);
    }

    return c.json({ capture });
  })
  .post(
    "/game-captures/:sessionKey/frames",
    validator("json", (value, c) => {
      const parsed = appendGameCaptureFrameSchema.safeParse(value);

      if (!parsed.success) {
        return c.json(
          {
            error: "Invalid capture frame",
            issues: parsed.error.flatten()
          },
          400
        );
      }

      return parsed.data;
    }),
    async (c) => {
      const gallery = await appendGalleryFrame(c.req.param("sessionKey"), c.req.valid("json"));
      return c.json({ gallery }, 201);
    }
  )
  .get("/game-captures/:sessionKey/gallery", async (c) => {
    const gallery = await getCaptureGallery(c.req.param("sessionKey"));

    if (!gallery) {
      return c.json({ error: "Gallery not found" }, 404);
    }

    return c.json({ gallery });
  });

export const app = new Hono()
  .get("/", (c) => c.text("QuackHacks API scaffold. Try /api/health."))
  .route("/api", api);

export type AppType = typeof app;
