import { env } from "cloudflare:workers";
import { app } from "./app.js";
import { GlobalGame } from "./durable/global-game.js";

export { GlobalGame };

export default {
  fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/ws") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return Response.json({ error: "Expected a WebSocket upgrade" }, { status: 426 });
      }

      return env.GLOBAL_GAME.getByName("global").fetch(request);
    }

    if (url.pathname.startsWith("/api/")) {
      return app.fetch(request);
    }

    return env.ASSETS.fetch(request);
  }
} satisfies ExportedHandler<Cloudflare.Env>;
