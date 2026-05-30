import { Hono } from "hono";
import { cors } from "hono/cors";
import type { SubmitScore } from "@quackhacks/shared";
import { addScore, topScores } from "./db.js";

// The Hono app. The exported `AppType` is consumed by the frontend's
// hono/client `hc<AppType>()` so API routes are fully typed end-to-end.
const app = new Hono()
  .use("*", cors())
  .get("/api/health", (c) => c.json({ ok: true, service: "quackhacks-server" }))
  .get("/api/leaderboard", (c) => {
    const limit = Number(c.req.query("limit") ?? 10);
    return c.json({ entries: topScores(limit) });
  })
  .post("/api/leaderboard", async (c) => {
    const body = (await c.req.json()) as SubmitScore;
    if (!body?.name || typeof body.score !== "number") {
      return c.json({ error: "name and numeric score are required" }, 400);
    }
    const entry = addScore({
      name: body.name,
      score: body.score,
      survivalTime: body.survivalTime ?? 0,
    });
    return c.json({ entry }, 201);
  });

export type AppType = typeof app;
export { app };
