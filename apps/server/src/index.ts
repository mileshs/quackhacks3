import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { Server as SocketIOServer } from "socket.io";
import { SocketEvents } from "@quackhacks/shared";
import { app } from "./app.js";

const PORT = Number(process.env.PORT ?? 3001);

// --- Hono native websockets ----------------------------------------------
// A simple echo endpoint at /ws to prove the hono ws integration works.
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

app.get(
  "/ws",
  upgradeWebSocket(() => ({
    onOpen(_evt, ws) {
      ws.send(JSON.stringify({ type: "hello", from: "hono-ws" }));
    },
    onMessage(evt, ws) {
      ws.send(JSON.stringify({ type: "echo", data: String(evt.data) }));
    },
  }))
);

// --- Boot the Node HTTP server --------------------------------------------
const server = serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[server] hono listening on http://localhost:${info.port}`);
});

// Attach hono's websocket upgrade handler to the underlying server.
injectWebSocket(server);

// --- socket.io on the same HTTP server ------------------------------------
const io = new SocketIOServer(server as unknown as import("node:http").Server, {
  cors: { origin: "*" },
});

io.on("connection", (socket) => {
  console.log(`[socket.io] connected: ${socket.id}`);

  socket.on(SocketEvents.JoinRoom, (room: string) => {
    socket.join(room);
    socket.emit(SocketEvents.JoinRoom, { room, ok: true });
  });

  // Saboteur -> poser: relay live dummy pose updates within a room.
  socket.on(SocketEvents.PoseUpdate, ({ room, pose }) => {
    socket.to(room).emit(SocketEvents.PoseUpdate, pose);
  });

  socket.on("disconnect", () => {
    console.log(`[socket.io] disconnected: ${socket.id}`);
  });
});

console.log(`[server] socket.io + hono-ws ready on port ${PORT}`);
