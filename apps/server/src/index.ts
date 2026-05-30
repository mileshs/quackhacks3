import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { Server as SocketIoServer } from "socket.io";
import { app } from "./app.js";

const port = Number(process.env.PORT ?? 8787);
const clientOrigin = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

app.get(
  "/ws",
  upgradeWebSocket(() => ({
    onOpen: (_event, ws) => {
      ws.send(
        JSON.stringify({
          type: "hello",
          transport: "hono-websocket",
          sentAt: new Date().toISOString()
        })
      );
    },
    onMessage: (event, ws) => {
      ws.send(
        JSON.stringify({
          type: "echo",
          transport: "hono-websocket",
          payload: event.data,
          sentAt: new Date().toISOString()
        })
      );
    }
  }))
);

const server = serve({
  fetch: app.fetch,
  port
});

injectWebSocket(server);

const io = new SocketIoServer(server, {
  cors: {
    origin: clientOrigin,
    credentials: true
  }
});

io.on("connection", (socket) => {
  socket.emit("server:hello", {
    transport: "socket.io",
    socketId: socket.id,
    sentAt: new Date().toISOString()
  });

  socket.on("pose:preview", (pose) => {
    socket.broadcast.emit("pose:preview", {
      pose,
      sentAt: new Date().toISOString()
    });
  });
});

console.log(`QuackHacks API listening on http://localhost:${port}`);
