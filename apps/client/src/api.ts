import { hc } from "hono/client";
import type { AppType } from "@quackhacks/server/app";

// Typed Hono RPC client. Routes/response types come straight from the server's
// AppType — do NOT hand-roll a fetch wrapper. In dev, requests hit the Vite
// proxy (/api -> localhost:3001).
export const api = hc<AppType>("/");
