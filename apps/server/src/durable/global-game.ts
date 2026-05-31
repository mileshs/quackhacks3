import { DurableObject } from "cloudflare:workers";
import type {
  ActiveGameState,
  GameClientMessage,
  GameServerMessage,
  RealtimePoseMessage
} from "@quackhacks/shared";

const GAME_STATE_KEY = "global-game-state";

type StoredGameState = Omit<ActiveGameState, "playerCount">;

function createInactiveState(): StoredGameState {
  const now = new Date().toISOString();

  return {
    activeGame: false,
    gameId: null,
    startedAt: null,
    updatedAt: now
  };
}

export class GlobalGame extends DurableObject<Cloudflare.Env> {
  private cachedState: StoredGameState | null = null;

  async fetch(request: Request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return Response.json({ error: "Expected a WebSocket upgrade" }, { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

    this.ctx.acceptWebSocket(server);
    await this.broadcastState();

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  async webSocketMessage(ws: WebSocket, rawMessage: string | ArrayBuffer) {
    if (typeof rawMessage !== "string") {
      this.sendError(ws, "Only JSON text messages are supported.");
      return;
    }

    const message = parseClientMessage(rawMessage);
    if (!message) {
      this.sendError(ws, "Invalid game message.");
      return;
    }

    if (message.type === "game:start") {
      await this.startGame();
      return;
    }

    if (message.type === "game:end") {
      await this.endGame();
      return;
    }

    if (message.type === "pose:update") {
      this.broadcast({
        type: "pose:update",
        pose: message.pose,
        sentAt: new Date().toISOString()
      });
    }
  }

  async webSocketClose() {
    await this.broadcastState();
  }

  async webSocketError() {
    await this.broadcastState();
  }

  private async startGame() {
    const now = new Date().toISOString();
    const current = await this.loadStoredState();

    await this.saveStoredState({
      activeGame: true,
      gameId: current.activeGame && current.gameId ? current.gameId : crypto.randomUUID(),
      startedAt: current.activeGame && current.startedAt ? current.startedAt : now,
      updatedAt: now
    });
  }

  private async endGame() {
    const now = new Date().toISOString();

    await this.saveStoredState({
      activeGame: false,
      gameId: null,
      startedAt: null,
      updatedAt: now
    });
  }

  private async loadStoredState() {
    if (this.cachedState) {
      return this.cachedState;
    }

    const stored = await this.ctx.storage.get<StoredGameState>(GAME_STATE_KEY);
    this.cachedState = stored ?? createInactiveState();

    if (!stored) {
      await this.ctx.storage.put(GAME_STATE_KEY, this.cachedState);
    }

    return this.cachedState;
  }

  private async saveStoredState(state: StoredGameState) {
    this.cachedState = state;
    await this.ctx.storage.put(GAME_STATE_KEY, state);
    await this.broadcastState();
  }

  private async buildState(): Promise<ActiveGameState> {
    const stored = await this.loadStoredState();

    return {
      ...stored,
      playerCount: this.ctx.getWebSockets().length
    };
  }

  private async broadcastState() {
    this.broadcast({
      type: "game:state",
      state: await this.buildState()
    });
  }

  private broadcast(message: GameServerMessage | RealtimePoseMessage) {
    const payload = JSON.stringify(message);

    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(payload);
      } catch {
        socket.close(1011, "Unable to send message");
      }
    }
  }

  private sendError(ws: WebSocket, error: string) {
    ws.send(JSON.stringify({ type: "error", error } satisfies GameServerMessage));
  }
}

function parseClientMessage(rawMessage: string): GameClientMessage | null {
  try {
    const parsed = JSON.parse(rawMessage) as Partial<GameClientMessage>;

    if (parsed.type === "game:start" || parsed.type === "game:end") {
      return { type: parsed.type };
    }

    if (parsed.type === "pose:update" && parsed.pose) {
      return {
        type: "pose:update",
        pose: parsed.pose
      };
    }
  } catch {
    return null;
  }

  return null;
}
