import { DurableObject } from "cloudflare:workers";
import {
  GameRole,
  type ActiveGameState,
  type GameClientMessage,
  type GameServerMessage,
  type PowerupActivatePayload,
  type RealtimePoseMessage,
  type RoundSnapshotPayload
} from "@quackhacks/shared";

const GAME_STATE_KEY = "global-game-state";
const HEARTBEAT_TIMEOUT_MS = 12_000;
const HEARTBEAT_SWEEP_MS = 4_000;
const COUNTDOWN_MS = 3_000;

type RoleSocketAttachment = {
  role?: GameRole;
  lastSeenAt?: string;
  ready?: boolean;
};

type StoredGameState = Omit<ActiveGameState, "playerCount" | "roles">;

function createInactiveState(): StoredGameState {
  const now = new Date().toISOString();

  return {
    activeGame: false,
    gameId: null,
    startedAt: null,
    endedAt: null,
    endReason: null,
    phase: "idle",
    countdownStartedAt: null,
    playingStartedAt: null,
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
    await this.advanceCountdownIfElapsed({ broadcast: false });
    await this.broadcastState();

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  async webSocketMessage(ws: WebSocket, rawMessage: string | ArrayBuffer) {
    await this.advanceCountdownIfElapsed({ broadcast: true });

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
      await this.endGame("manual");
      return;
    }

    if (message.type === "game:complete") {
      await this.endGame("soundtrack-complete");
      return;
    }

    if (message.type === "game:dev-start") {
      await this.devStartGame();
      return;
    }

    if (message.type === "role:claim") {
      await this.claimRole(ws, message.role);
      return;
    }

    if (message.type === "role:heartbeat") {
      await this.refreshRole(ws, message.role);
      return;
    }

    if (message.type === "role:ready") {
      await this.setRoleReady(ws, message.role, message.ready);
      return;
    }

    if (message.type === "pose:update") {
      this.broadcast({
        type: "pose:update",
        pose: message.pose,
        sentAt: new Date().toISOString()
      });
      return;
    }

    if (message.type === "round:snapshot") {
      this.broadcast({
        type: "round:snapshot",
        payload: message.payload,
        sentAt: new Date().toISOString()
      });
      return;
    }

    if (message.type === "powerup:activate") {
      this.broadcast({
        type: "powerup:activate",
        payload: message.payload,
        sentAt: new Date().toISOString()
      });
    }
  }

  async webSocketClose(ws: WebSocket) {
    if (this.getSocketRole(ws)) {
      ws.serializeAttachment({});
      await this.endGameIfRoleWasPlaying("role-disconnected");
      return;
    }

    await this.broadcastState();
  }

  async webSocketError(ws: WebSocket) {
    if (this.getSocketRole(ws)) {
      ws.serializeAttachment({});
      await this.endGameIfRoleWasPlaying("role-disconnected");
      return;
    }

    await this.scheduleNextAlarm();
    await this.broadcastState();
  }

  async alarm() {
    await this.runScheduledTasks();
  }

  private async startGame() {
    const now = new Date().toISOString();
    const current = await this.loadStoredState();

    await this.saveStoredState({
      activeGame: true,
      gameId: current.activeGame && current.gameId ? current.gameId : crypto.randomUUID(),
      startedAt: current.activeGame && current.startedAt ? current.startedAt : now,
      endedAt: null,
      endReason: null,
      phase: "waiting",
      countdownStartedAt: null,
      playingStartedAt: null,
      updatedAt: now
    });
  }

  private async endGame(reason: StoredGameState["endReason"]) {
    const now = new Date().toISOString();

    for (const socket of this.ctx.getWebSockets()) {
      socket.serializeAttachment({});
    }

    await this.saveStoredState({
      activeGame: false,
      gameId: null,
      startedAt: null,
      endedAt: now,
      endReason: reason,
      phase: "idle",
      countdownStartedAt: null,
      playingStartedAt: null,
      updatedAt: now
    });
  }

  private async endGameIfRoleWasPlaying(reason: Extract<StoredGameState["endReason"], "role-disconnected" | "role-timeout">) {
    const state = await this.loadStoredState();

    if (state.phase === "playing") {
      await this.endGame(reason);
      return;
    }

    if (state.phase === "countdown") {
      await this.saveStoredState({
        ...state,
        phase: "waiting",
        countdownStartedAt: null,
        playingStartedAt: null,
        updatedAt: new Date().toISOString()
      });
      return;
    }

    await this.scheduleNextAlarm(state);
    await this.broadcastState();
  }

  private async devStartGame() {
    const state = await this.loadStoredState();

    if (!state.activeGame) {
      return;
    }

    await this.saveStoredState({
      ...state,
      phase: "playing",
      countdownStartedAt: null,
      playingStartedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  private async claimRole(ws: WebSocket, role: GameRole) {
    const state = await this.loadStoredState();
    const now = new Date().toISOString();

    if (!state.activeGame) {
      this.sendRoleRejected(ws, role, "inactive-game");
      return;
    }

    const currentOwner = this.findRoleOwner(role);
    if (currentOwner && currentOwner !== ws) {
      this.sendRoleRejected(ws, role, "taken");
      return;
    }

    ws.serializeAttachment({ role, lastSeenAt: now, ready: false } satisfies RoleSocketAttachment);
    this.send(ws, { type: "role:accepted", role });
    await this.scheduleNextAlarm(state);
    await this.broadcastState();
  }

  private async refreshRole(ws: WebSocket, role: GameRole) {
    const state = await this.loadStoredState();
    const currentRole = this.getSocketRole(ws);

    if (!state.activeGame || currentRole !== role) {
      this.sendRoleRejected(ws, role, state.activeGame ? "taken" : "inactive-game");
      return;
    }

    const attachment = this.getSocketAttachment(ws);
    ws.serializeAttachment({ ...attachment, role, lastSeenAt: new Date().toISOString() } satisfies RoleSocketAttachment);
    await this.scheduleNextAlarm(state);
    await this.broadcastState();
  }

  private async setRoleReady(ws: WebSocket, role: GameRole, ready: boolean) {
    const state = await this.loadStoredState();
    const currentRole = this.getSocketRole(ws);

    if (!state.activeGame || currentRole !== role || state.phase === "playing") {
      this.sendRoleRejected(ws, role, state.activeGame ? "taken" : "inactive-game");
      return;
    }

    const attachment = this.getSocketAttachment(ws);
    ws.serializeAttachment({
      ...attachment,
      role,
      ready,
      lastSeenAt: new Date().toISOString()
    } satisfies RoleSocketAttachment);

    if (this.allRolesReady()) {
      await this.beginCountdown();
      return;
    }

    if (state.phase === "countdown") {
      await this.saveStoredState({
        ...state,
        phase: "waiting",
        countdownStartedAt: null,
        playingStartedAt: null,
        updatedAt: new Date().toISOString()
      });
      return;
    }

    await this.scheduleNextAlarm(state);
    await this.broadcastState();
  }

  private async loadStoredState() {
    if (this.cachedState) {
      return this.cachedState;
    }

    const stored = await this.ctx.storage.get<Partial<StoredGameState>>(GAME_STATE_KEY);
    this.cachedState = stored ? normalizeStoredState(stored) : createInactiveState();

    if (!stored) {
      await this.ctx.storage.put(GAME_STATE_KEY, this.cachedState);
    }

    return this.cachedState;
  }

  private async saveStoredState(state: StoredGameState) {
    this.cachedState = state;
    await this.ctx.storage.put(GAME_STATE_KEY, state);
    await this.scheduleNextAlarm(state);
    await this.broadcastState();
  }

  private async buildState(): Promise<ActiveGameState> {
    const stored = await this.loadStoredState();

    return {
      ...stored,
      playerCount: this.ctx.getWebSockets().length,
      roles: stored.activeGame ? this.buildRoles() : createEmptyRoles()
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

  private send(ws: WebSocket, message: GameServerMessage) {
    ws.send(JSON.stringify(message));
  }

  private sendError(ws: WebSocket, error: string) {
    this.send(ws, { type: "error", error });
  }

  private sendRoleRejected(ws: WebSocket, role: GameRole, reason: "taken" | "inactive-game" | "invalid-role") {
    this.send(ws, { type: "role:rejected", role, reason });
  }

  private buildRoles(): ActiveGameState["roles"] {
    const roles = createEmptyRoles();

    for (const socket of this.ctx.getWebSockets()) {
      const attachment = this.getSocketAttachment(socket);

      if (attachment.role && isGameRole(attachment.role)) {
        roles[attachment.role] = {
          status: "occupied",
          lastSeenAt: attachment.lastSeenAt ?? null,
          ready: attachment.ready ?? false
        };
      }
    }

    return roles;
  }

  private findRoleOwner(role: GameRole) {
    return this.ctx.getWebSockets().find((socket) => this.getSocketRole(socket) === role) ?? null;
  }

  private getSocketRole(ws: WebSocket) {
    const role = this.getSocketAttachment(ws).role;
    return isGameRole(role) ? role : null;
  }

  private getSocketAttachment(ws: WebSocket): RoleSocketAttachment {
    return (ws.deserializeAttachment() ?? {}) as RoleSocketAttachment;
  }

  private async advanceCountdownIfElapsed({ broadcast }: { broadcast: boolean }) {
    const state = await this.loadStoredState();

    if (!state.activeGame || state.phase !== "countdown" || !state.countdownStartedAt) {
      return { state, advanced: false };
    }

    const countdownElapsed = Date.now() - Date.parse(state.countdownStartedAt);

    if (countdownElapsed < COUNTDOWN_MS) {
      return { state, advanced: false };
    }

    const nextState = {
      ...state,
      phase: "playing",
      countdownStartedAt: null,
      playingStartedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } satisfies StoredGameState;

    this.cachedState = nextState;
    await this.ctx.storage.put(GAME_STATE_KEY, nextState);
    await this.scheduleNextAlarm(nextState);

    if (broadcast) {
      await this.broadcastState();
    }

    return { state: nextState, advanced: true };
  }

  private async runScheduledTasks() {
    const { state } = await this.advanceCountdownIfElapsed({ broadcast: true });

    if (!state.activeGame) {
      await this.scheduleNextAlarm(state);
      return;
    }

    const now = Date.now();

    const claimedRoles = Object.values(this.buildRoles()).filter((role) => role.status === "occupied");
    const hasTimedOutRole = claimedRoles.some((role) => {
      if (!role.lastSeenAt) {
        return true;
      }

      return now - Date.parse(role.lastSeenAt) > HEARTBEAT_TIMEOUT_MS;
    });

    if (hasTimedOutRole) {
      await this.clearTimedOutRoles();
      await this.endGameIfRoleWasPlaying("role-timeout");
      return;
    }

    await this.scheduleNextAlarm(state);
  }

  private async scheduleNextAlarm(state = this.cachedState) {
    const currentState = state ?? (await this.loadStoredState());

    if (!currentState.activeGame) {
      await this.ctx.storage.deleteAlarm();
      return;
    }

    const deadlines: number[] = [];

    if (currentState.phase === "countdown" && currentState.countdownStartedAt) {
      deadlines.push(Date.parse(currentState.countdownStartedAt) + COUNTDOWN_MS);
    }

    const hasClaimedRole = Object.values(this.buildRoles()).some((role) => role.status === "occupied");
    if (hasClaimedRole) {
      deadlines.push(Date.now() + HEARTBEAT_SWEEP_MS);
    }

    if (deadlines.length === 0) {
      await this.ctx.storage.deleteAlarm();
      return;
    }

    await this.ctx.storage.setAlarm(Math.max(Date.now(), Math.min(...deadlines)));
  }

  private async clearTimedOutRoles() {
    const now = Date.now();

    for (const socket of this.ctx.getWebSockets()) {
      const attachment = this.getSocketAttachment(socket);

      if (!attachment.role || !attachment.lastSeenAt) {
        continue;
      }

      if (now - Date.parse(attachment.lastSeenAt) > HEARTBEAT_TIMEOUT_MS) {
        socket.serializeAttachment({});
      }
    }
  }

  private allRolesReady() {
    const roles = this.buildRoles();

    return (
      roles[GameRole.Dummy].status === "occupied" &&
      roles[GameRole.Saboteur].status === "occupied" &&
      roles[GameRole.Dummy].ready &&
      roles[GameRole.Saboteur].ready
    );
  }

  private async beginCountdown() {
    const state = await this.loadStoredState();

    await this.saveStoredState({
      ...state,
      phase: "countdown",
      countdownStartedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
}

function parseClientMessage(rawMessage: string): GameClientMessage | null {
  try {
    const parsed = JSON.parse(rawMessage) as Partial<GameClientMessage> & { payload?: unknown };

    if (
      parsed.type === "game:start" ||
      parsed.type === "game:end" ||
      parsed.type === "game:complete" ||
      parsed.type === "game:dev-start"
    ) {
      return { type: parsed.type };
    }

    if (
      (parsed.type === "role:claim" || parsed.type === "role:heartbeat") &&
      parsed.role &&
      isGameRole(parsed.role)
    ) {
      return {
        type: parsed.type,
        role: parsed.role
      };
    }

    if (parsed.type === "role:ready" && parsed.role && isGameRole(parsed.role)) {
      return {
        type: "role:ready",
        role: parsed.role,
        ready: Boolean(parsed.ready)
      };
    }

    if (parsed.type === "pose:update" && parsed.pose) {
      return {
        type: "pose:update",
        pose: parsed.pose
      };
    }

    if (parsed.type === "round:snapshot" && isRoundSnapshotPayload(parsed.payload)) {
      return {
        type: "round:snapshot",
        payload: parsed.payload
      };
    }

    if (parsed.type === "powerup:activate" && isPowerupActivatePayload(parsed.payload)) {
      return {
        type: "powerup:activate",
        payload: parsed.payload
      };
    }
  } catch {
    return null;
  }

  return null;
}

function createEmptyRoles(): ActiveGameState["roles"] {
  return {
    [GameRole.Dummy]: { status: "empty", lastSeenAt: null, ready: false },
    [GameRole.Saboteur]: { status: "empty", lastSeenAt: null, ready: false }
  };
}

function normalizeStoredState(stored: Partial<StoredGameState>): StoredGameState {
  const fallback = createInactiveState();

  return {
    activeGame: stored.activeGame ?? fallback.activeGame,
    gameId: stored.gameId ?? fallback.gameId,
    startedAt: stored.startedAt ?? fallback.startedAt,
    endedAt: stored.endedAt ?? fallback.endedAt,
    endReason: stored.endReason ?? fallback.endReason,
    phase: stored.phase ?? (stored.activeGame ? "waiting" : "idle"),
    countdownStartedAt: stored.countdownStartedAt ?? fallback.countdownStartedAt,
    playingStartedAt: stored.playingStartedAt ?? fallback.playingStartedAt,
    updatedAt: stored.updatedAt ?? fallback.updatedAt
  };
}

function isGameRole(role: unknown): role is GameRole {
  return role === GameRole.Dummy || role === GameRole.Saboteur;
}

function isRoundSnapshotPayload(payload: unknown): payload is RoundSnapshotPayload {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Partial<RoundSnapshotPayload>;
  return (
    typeof candidate.matchPercent === "number" &&
    (candidate.band === "PERFECT" || candidate.band === "CLEAN" || candidate.band === "CRASH") &&
    typeof candidate.sentAt === "string"
  );
}

function isPowerupActivatePayload(payload: unknown): payload is PowerupActivatePayload {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Partial<PowerupActivatePayload>;
  return (
    (candidate.kind === "blindness" || candidate.kind === "mirror") &&
    (candidate.durationMs === undefined || typeof candidate.durationMs === "number") &&
    typeof candidate.sentAt === "string"
  );
}
