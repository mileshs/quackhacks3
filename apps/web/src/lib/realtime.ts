import { io, type Socket } from "socket.io-client";

export function createSocketConnection(): Socket {
  const origin = import.meta.env.VITE_SOCKET_URL ?? window.location.origin;

  return io(origin, {
    path: "/socket.io"
  });
}

export function createHonoWebSocket() {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const host = import.meta.env.VITE_WS_HOST ?? window.location.host;

  return new WebSocket(`${protocol}://${host}/ws`);
}
