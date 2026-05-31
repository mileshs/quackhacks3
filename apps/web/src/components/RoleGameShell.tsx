import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { GameRole } from "@quackhacks/shared";
import { useNavigate } from "react-router-dom";
import { queueGameNotice } from "../lib/gameNotifications";
import { useDevSection } from "../lib/settings";
import { cx } from "../lib/ui";
import type { useActiveGame } from "../lib/useActiveGame";

// Buttons inside the cream Settings dropdown (dark text on light surfaces).
const devMenuButton =
  "w-full rounded-[12px] bg-white px-3 py-2 text-sm font-extrabold text-[#2b303b] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] transition-colors hover:bg-[#fff7e8]";
const devMenuDanger =
  "w-full rounded-[12px] bg-[#ef5c6b] px-3 py-2 text-sm font-extrabold text-white shadow-[inset_0_1.5px_0_rgba(255,255,255,0.3)] transition-[filter] hover:brightness-105";

const COUNTDOWN_SECONDS = 3;

type ActiveGameControls = ReturnType<typeof useActiveGame>;

type RoleGameShellProps = {
  role: GameRole;
  controls: ActiveGameControls;
  children: ReactNode;
};

const roleLabels = {
  [GameRole.Dummy]: "Dummy",
  [GameRole.Saboteur]: "Saboteur"
} satisfies Record<GameRole, string>;

export function RoleGameShell({ role, controls, children }: RoleGameShellProps) {
  const navigate = useNavigate();
  const [confirmEndOpen, setConfirmEndOpen] = useState(false);
  const [devSolo, setDevSolo] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const {
    claimedRole,
    claimRole,
    connectionStatus,
    devStartGame,
    endGame,
    game,
    roleError,
    sendRoleHeartbeat,
    setRoleReady
  } = controls;
  const isDev = import.meta.env.DEV;
  const otherRole = role === GameRole.Dummy ? GameRole.Saboteur : GameRole.Dummy;
  const roleLabel = roleLabels[role];
  const otherRoleLabel = roleLabels[otherRole];
  const selfClaim = game?.roles[role];
  const otherClaim = game?.roles[otherRole];
  const hasActiveGame = game?.activeGame ?? false;
  const hasClaimedRole = claimedRole === role;
  const otherJoined = otherClaim?.status === "occupied";
  const selfReady = selfClaim?.ready ?? false;
  const otherReady = otherClaim?.ready ?? false;
  const playing = devSolo || game?.phase === "playing";
  const countdownSeconds = useMemo(() => {
    if (game?.phase !== "countdown" || !game.countdownStartedAt) {
      return null;
    }

    const elapsed = Math.max(0, now - Date.parse(game.countdownStartedAt));
    return Math.max(1, COUNTDOWN_SECONDS - Math.floor(elapsed / 1000));
  }, [game?.countdownStartedAt, game?.phase, now]);

  useEffect(() => {
    if (!isDev && game && !game.activeGame && !game.endReason) {
      navigate("/");
    }
  }, [game, isDev, navigate]);

  useEffect(() => {
    if (!game || game.activeGame) {
      return;
    }

    if (game.endReason === "role-disconnected" || game.endReason === "role-timeout") {
      queueGameNotice("A player disconnected, so the game ended.");
    } else if (game.endReason === "manual") {
      queueGameNotice("Game ended.");
    }

    navigate("/");
  }, [game, navigate]);

  useEffect(() => {
    if (roleError && !isDev) {
      queueGameNotice("That role is not available anymore.");
      navigate("/");
    }
  }, [isDev, navigate, roleError]);

  useEffect(() => {
    if (connectionStatus === "connected" && hasActiveGame && claimedRole !== role && !roleError) {
      claimRole(role);
    }
  }, [claimRole, claimedRole, connectionStatus, hasActiveGame, role, roleError]);

  useEffect(() => {
    if (!hasClaimedRole) {
      return;
    }

    sendRoleHeartbeat(role);
    const intervalId = window.setInterval(() => sendRoleHeartbeat(role), 5_000);

    return () => window.clearInterval(intervalId);
  }, [hasClaimedRole, role, sendRoleHeartbeat]);

  useEffect(() => {
    if (game?.phase !== "countdown") {
      return;
    }

    const intervalId = window.setInterval(() => setNow(Date.now()), 150);

    return () => window.clearInterval(intervalId);
  }, [game?.phase]);

  function confirmEndGame() {
    setConfirmEndOpen(false);
    endGame();
  }

  function toggleReady() {
    setRoleReady(role, !selfReady);
  }

  const startDevSolo = useCallback(() => {
    if (hasActiveGame) {
      devStartGame();
      return;
    }

    setDevSolo(true);
  }, [hasActiveGame, devStartGame]);

  // Game controls (win / end / dev bypass) live in the global Settings menu under Dev Mode.
  // Only the game pages mount RoleGameShell, so these only appear on game screens.
  const gameDevSection = useMemo(
    () => (
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-extrabold tracking-[0.12em] text-[#a89a82] uppercase">Game</span>
        <button className={devMenuButton} type="button" onClick={() => navigate(`/score?winner=${role}`)}>
          I Won
        </button>
        <button className={devMenuDanger} type="button" onClick={() => setConfirmEndOpen(true)}>
          End Game
        </button>
        <button className={devMenuButton} type="button" onClick={startDevSolo}>
          Dev Bypass
        </button>
      </div>
    ),
    [navigate, role, startDevSolo]
  );
  useDevSection("game", gameDevSection);

  const overlay = playing ? null : (
    <RoleLobbyOverlay
      roleLabel={roleLabel}
      otherRoleLabel={otherRoleLabel}
      otherJoined={Boolean(otherJoined)}
      selfReady={selfReady}
      otherReady={otherReady}
      countdownSeconds={countdownSeconds}
      hasActiveGame={hasActiveGame}
      hasClaimedRole={hasClaimedRole}
      onReady={toggleReady}
    />
  );

  return (
    <div className="relative min-h-[calc(100dvh-4.5rem)] overflow-hidden">
      <div
        className={cx(
          "transition duration-500",
          overlay && "pointer-events-none scale-[0.99] opacity-35 blur-[2px]"
        )}
      >
        {children}
      </div>

      {overlay}

      {confirmEndOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/72 px-4 backdrop-blur-[3px]" role="dialog" aria-modal="true">
          <div className="relative z-[1] w-[min(520px,100%)] text-center">
            <p className="mt-0 mb-2 text-sm font-black tracking-normal text-[#ffd65c] uppercase">End game?</p>
            <h2 className="mt-0 mb-3 text-[clamp(2.5rem,10vw,5rem)] leading-[0.86] font-black text-white [text-shadow:0_5px_0_rgba(0,0,0,0.28)]">Everyone goes home.</h2>
            <p className="mx-auto mt-0 mb-6 max-w-[24rem] text-base leading-5 font-black text-white/82">
              This will close the active run for both screens.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button className="inline-flex min-h-13 items-center justify-center rounded-[1rem] border border-[#d93236] bg-[#ef4b4f] px-7 py-3 font-black text-white uppercase shadow-[inset_0_3px_0_rgba(255,255,255,0.42),inset_0_-3px_0_rgba(142,20,27,0.28)] [text-shadow:0_2px_0_rgba(100,10,16,0.24)]" type="button" onClick={confirmEndGame}>
                End Game
              </button>
              <button className="inline-flex min-h-13 items-center justify-center rounded-[1rem] bg-white px-7 py-3 font-black text-[#28303d] uppercase shadow-[inset_0_2px_0_rgba(255,255,255,0.8),inset_0_-3px_0_rgba(221,179,83,0.22)]" type="button" onClick={() => setConfirmEndOpen(false)}>
                Keep Playing
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type RoleLobbyOverlayProps = {
  roleLabel: string;
  otherRoleLabel: string;
  otherJoined: boolean;
  selfReady: boolean;
  otherReady: boolean;
  countdownSeconds: number | null;
  hasActiveGame: boolean;
  hasClaimedRole: boolean;
  onReady: () => void;
};

function RoleLobbyOverlay({
  roleLabel,
  otherRoleLabel,
  otherJoined,
  selfReady,
  otherReady,
  countdownSeconds,
  hasActiveGame,
  hasClaimedRole,
  onReady
}: RoleLobbyOverlayProps) {
  if (countdownSeconds) {
    return (
      <div className="fixed inset-0 z-30 grid place-items-center overflow-hidden bg-black/64 px-4 py-20 backdrop-blur-[2px]">
        <div className="relative z-[1] text-center">
          <p className="m-0 text-[clamp(1rem,3vw,1.5rem)] font-black tracking-normal text-[#ffd65c] uppercase">Get ready</p>
          <div className="mt-3 text-[clamp(9rem,32vw,20rem)] leading-[0.76] font-black text-white drop-shadow-[0_14px_0_rgba(0,0,0,0.32)] animate-[countdown-pop_0.45s_ease-out_infinite_alternate]">
            {countdownSeconds}
          </div>
        </div>
      </div>
    );
  }

  const statusText = !hasActiveGame
    ? "No active game"
    : !hasClaimedRole
      ? `Claiming ${roleLabel.toLowerCase()}...`
      : !otherJoined
        ? `Waiting for ${otherRoleLabel.toLowerCase()}...`
        : "Ready check";

  return (
    <div className="fixed inset-0 z-30 grid place-items-center overflow-hidden bg-black/60 px-4 py-20 backdrop-blur-[2px]">
      <div className="pointer-events-auto relative w-[min(560px,100%)] text-center">
        <div className="relative px-3 py-4 text-white">
          <p className="mt-0 mb-3 text-sm font-black tracking-normal text-[#ffd65c] uppercase">{roleLabel} screen</p>
          <h1 className="mt-0 mb-6 text-[clamp(2.75rem,8vw,5.8rem)] leading-[0.88] font-black text-white [text-shadow:0_5px_0_rgba(0,0,0,0.28)]">
            {statusText}
          </h1>

          <div className="mx-auto mb-6 grid max-w-[32rem] grid-cols-2 gap-3">
            <ReadyBadge label={roleLabel} ready={selfReady} joined={hasClaimedRole} />
            <ReadyBadge label={otherRoleLabel} ready={otherReady} joined={otherJoined} />
          </div>

          {hasActiveGame && hasClaimedRole && otherJoined && !countdownSeconds ? (
            <button className="min-h-14 rounded-[1.15rem] border border-[#ee9a06] bg-[#ffaf09] px-8 text-lg font-black text-white uppercase shadow-[inset_0_3px_0_rgba(255,255,255,0.54),inset_0_-3px_0_rgba(206,120,0,0.22)] [text-shadow:0_2px_0_rgba(156,86,0,0.24)]" type="button" onClick={onReady}>
              {selfReady ? "Unready" : "Ready Up"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ReadyBadge({ label, joined, ready }: { label: string; joined: boolean; ready: boolean }) {
  const text = !joined ? "Waiting" : ready ? "Ready" : "Not ready";

  return (
    <div className="rounded-[1rem] bg-white/14 px-4 py-3 text-left shadow-[inset_0_0_0_1px_rgba(255,255,255,0.14)] backdrop-blur-sm">
      <p className="m-0 text-xs font-black tracking-normal text-white/68 uppercase">{label}</p>
      <p className={cx("m-0 text-lg font-black", ready ? "text-[#75e2be]" : joined ? "text-[#ffd65c]" : "text-white/72")}>{text}</p>
    </div>
  );
}
