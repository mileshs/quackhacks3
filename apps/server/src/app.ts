import { Hono } from "hono";
import { cors } from "hono/cors";
import { validator } from "hono/validator";
import {
  createLeaderboardEntrySchema,
  scoreBandFromMatch,
  scoreFromMatch,
  starterPoses
} from "@quackhacks/shared";
import {
  countLeaderboardEntries,
  createLeaderboardEntry,
  getDatabasePath,
  listLeaderboardEntries
} from "./db/leaderboard.js";

const clientOrigin = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

export const api = new Hono()
  .get("/health", async (c) => {
    const entries = await countLeaderboardEntries();

    return c.json({
      ok: true,
      service: "quackhacks-api",
      database: {
        path: getDatabasePath(),
        leaderboardEntries: entries
      },
      realtime: {
        honoWebSocket: "/ws",
        socketIo: "/socket.io"
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
  });

export const app = new Hono()
  .use(
    "/api/*",
    cors({
      origin: clientOrigin,
      credentials: true
    })
  )
  .get("/", (c) => c.text("QuackHacks API scaffold. Try /api/health."))
  .route("/api", api);

export type AppType = typeof app;
