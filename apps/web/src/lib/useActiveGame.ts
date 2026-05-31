import { useCallback, useEffect, useRef, useState } from "react";
import {
  type ActiveGameState,
  type GameClientMessage,
  type GameRole,
  type PowerupActivatePayload,
  type RoundSnapshotPayload,
  type UniversalPose
} from "@quackhacks/shared";
import { clearPersistedClaimedRole, writePersistedClaimedRole } from "./claimedRoleStorage";
import { createGameWebSocket, parseGameSocketMessage, sendGameSocketMessage } from "./realtime";

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "unavailable";

export function useActiveGame() {
  const [game, setGame] = useState<ActiveGameState | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
  const [claimedRole, setClaimedRole] = useState<GameRole | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [lastPose, setLastPose] = useState<UniversalPose | null>(null);
  const [lastRoundSnapshot, setLastRoundSnapshot] = useState<RoundSnapshotPayload | null>(null);
  const [lastPowerup, setLastPowerup] = useState<PowerupActivatePayload | null>(null);
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

      if (message?.type === "role:accepted") {
        setClaimedRole(message.role);
        setRoleError(null);
        writePersistedClaimedRole(message.role);
      }

      if (message?.type === "role:rejected") {
        setClaimedRole(null);
        setRoleError(message.reason);
        clearPersistedClaimedRole();
      }

      if (message?.type === "pose:update") {
        setLastPose(message.pose);
      }

      if (message?.type === "round:snapshot") {
        setLastRoundSnapshot(message.payload);
      }

      if (message?.type === "powerup:activate") {
        setLastPowerup(message.payload);
      }
    });

    socket.addEventListener("close", () => {
      setConnectionStatus("disconnected");
      setClaimedRole(null);
      clearPersistedClaimedRole();
    });

    socket.addEventListener("error", () => {
      setConnectionStatus("unavailable");
      setClaimedRole(null);
      clearPersistedClaimedRole();
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
    claimedRole,
    roleError,
    lastPose,
    lastRoundSnapshot,
    lastPowerup,
    startGame: useCallback(() => send({ type: "game:start" }), [send]),
    endGame: useCallback(() => send({ type: "game:end" }), [send]),
    completeGame: useCallback(() => send({ type: "game:complete" }), [send]),
    defeatGame: useCallback(() => send({ type: "game:defeat" }), [send]),
    devStartGame: useCallback(() => send({ type: "game:dev-start" }), [send]),
    claimRole: useCallback((role: GameRole) => send({ type: "role:claim", role }), [send]),
    sendRoleHeartbeat: useCallback((role: GameRole) => send({ type: "role:heartbeat", role }), [send]),
    setRoleReady: useCallback((role: GameRole, ready: boolean) => send({ type: "role:ready", role, ready }), [send]),
    sendPose: useCallback((pose: UniversalPose) => send({ type: "pose:update", pose }), [send]),
    sendRoundSnapshot: useCallback((payload: RoundSnapshotPayload) => send({ type: "round:snapshot", payload }), [send]),
    sendPowerup: useCallback((payload: PowerupActivatePayload) => send({ type: "powerup:activate", payload }), [send])
  };
}
