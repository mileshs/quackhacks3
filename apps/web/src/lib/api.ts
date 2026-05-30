import { hc } from "hono/client";
import type { AppType } from "@quackhacks/server/app";

const apiBaseUrl = import.meta.env.VITE_API_URL ?? "/";

export const api = hc<AppType>(apiBaseUrl);
