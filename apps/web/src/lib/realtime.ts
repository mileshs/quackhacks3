import type { GameClientMessage, GameServerMessage, RealtimePoseMessage } from "@quackhacks/shared";

export type GameSocketMessage = GameServerMessage | RealtimePoseMessage;

export function createGameWebSocket() {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const host = import.meta.env.VITE_WS_HOST ?? window.location.host;

  return new WebSocket(`${protocol}://${host}/ws`);
}

export function sendGameSocketMessage(socket: WebSocket | null, message: GameClientMessage) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return false;
  }

  socket.send(JSON.stringify(message));
  return true;
}

export function parseGameSocketMessage(rawMessage: MessageEvent["data"]): GameSocketMessage | null {
  if (typeof rawMessage !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(rawMessage) as GameSocketMessage;

    if (parsed.type === "game:state" || parsed.type === "pose:update" || parsed.type === "error") {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}
