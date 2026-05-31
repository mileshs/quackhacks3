import { useCallback, useEffect, useRef, useState } from "react";
import type { ActiveGameState, GameClientMessage, UniversalPose } from "@quackhacks/shared";
import { createGameWebSocket, parseGameSocketMessage, sendGameSocketMessage } from "./realtime";

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "unavailable";

export function useActiveGame() {
  const [game, setGame] = useState<ActiveGameState | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const socketRef = useRef<WebSocket | null>(null);
  const pendingMessagesRef = useRef<GameClientMessage[]>([]);

  const send = useCallback((message: GameClientMessage) => {
    if (sendGameSocketMessage(socketRef.current, message)) {
      return;
    }

    pendingMessagesRef.current.push(message);
  }, []);

  useEffect(() => {
    const socket = createGameWebSocket();
    socketRef.current = socket;
    setConnectionStatus("connecting");

    socket.addEventListener("open", () => {
      setConnectionStatus("connected");
      const pendingMessages = pendingMessagesRef.current.splice(0);
      for (const message of pendingMessages) {
        sendGameSocketMessage(socket, message);
      }
    });

    socket.addEventListener("message", (event) => {
      const message = parseGameSocketMessage(event.data);

      if (message?.type === "game:state") {
        setGame(message.state);
      }
    });

    socket.addEventListener("close", () => {
      setConnectionStatus("disconnected");
    });

    socket.addEventListener("error", () => {
      setConnectionStatus("unavailable");
    });

    return () => {
      pendingMessagesRef.current = [];
      socketRef.current = null;
      socket.close();
    };
  }, []);

  return {
    game,
    connectionStatus,
    startGame: useCallback(() => send({ type: "game:start" }), [send]),
    endGame: useCallback(() => send({ type: "game:end" }), [send]),
    sendPose: useCallback((pose: UniversalPose) => send({ type: "pose:update", pose }), [send])
  };
}
