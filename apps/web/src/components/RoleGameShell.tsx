import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { GameRole } from "@quackhacks/shared";
import { useNavigate } from "react-router-dom";
import { DefeatSequenceProvider } from "../lib/defeatSequence";
import { buildScorePath } from "../lib/gameCapture";
import { queueGameNotice } from "../lib/gameNotifications";
import { useDevSection } from "../lib/settings";
import { useRoleScopedSound } from "../hooks/useRoleScopedSound";
import { useSoundtrackGameSync } from "../hooks/useSoundtrackGameSync";
import { GameTempoProvider, useGameTempo } from "../lib/tempo";
import { cx } from "../lib/ui";
import { TempoIndicator } from "./TempoIndicator";
import type { useActiveGame } from "../lib/useActiveGame";

// Buttons inside the cream Settings dropdown (dark text on light surfaces).
const devMenuButton =
  "w-full rounded-[12px] bg-white px-3 py-2 text-sm font-extrabold text-[#2b303b] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] transition-colors hover:bg-[#fff7e8]";
const devMenuDanger =
  "w-full rounded-[12px] bg-[#ef5c6b] px-3 py-2 text-sm font-extrabold text-white shadow-[inset_0_1.5px_0_rgba(255,255,255,0.3)] transition-[filter] hover:brightness-105";

const COUNTDOWN_SECONDS = 3;

// Playful brand font + cream surface used across the app (home menu, athlete HUD), reused
// here so the "between" screens match the rest of the game instead of a bare dark overlay.
const lobbyFont = "font-[Nunito,Inter,ui-sans-serif,system-ui,sans-serif]";
const lobbyBackdrop = cx("fixed inset-0 z-30 grid place-items-center overflow-hidden bg-[#0c0f14]/70 px-4 backdrop-blur-md", lobbyFont);

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
  const { playSoundEffect } = useRoleScopedSound(role);
  const lastCountdownAnchorRef = useRef<string | null>(null);
  const playedGameOverRef = useRef(false);
  const [confirmEndOpen, setConfirmEndOpen] = useState(false);
  const [defeatSequenceActive, setDefeatSequenceActive] = useState(false);
  const [devSolo, setDevSolo] = useState(false);
  const [devSoloStartedAt, setDevSoloStartedAt] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const {
    claimedRole,
    claimRole,
    connectionStatus,
    completeGame,
    devStartGame,
    endGame,
    game,
    roleError,
    sendRoleHeartbeat,
    setRoleReady
  } = controls;
  const isDev = import.meta.env.DEV;
  const goToScore = useCallback(
    (winner: "dummy" | "saboteur") => {
      navigate(buildScorePath(winner, game?.gameId));
    },
    [game?.gameId, navigate]
  );
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
  const playingStartedAt = game?.playingStartedAt ?? devSoloStartedAt;

  const playGameOverOnce = useCallback(() => {
    if (playedGameOverRef.current) {
      return;
    }

    playedGameOverRef.current = true;
    playSoundEffect("gameOver");
  }, [playSoundEffect]);

  const handleSoundtrackComplete = useCallback(() => {
    if (hasActiveGame) {
      completeGame();
      return;
    }

    if (devSolo) {
      playGameOverOnce();
      setDevSolo(false);
      setDevSoloStartedAt(null);
      goToScore("dummy");
    }
  }, [completeGame, devSolo, goToScore, hasActiveGame, playGameOverOnce]);

  // Soundtrack audio only on the dummy/poser screen (avoids double playback with saboteur open).
  useSoundtrackGameSync({
    playing: role === GameRole.Dummy && playing,
    playingStartedAt: role === GameRole.Dummy && playing ? playingStartedAt : null,
    onSoundtrackComplete: handleSoundtrackComplete,
  });

  const countdownSeconds = useMemo(() => {
    if (game?.phase !== "countdown" || !game.countdownStartedAt) {
      return null;
    }

    const elapsed = Math.max(0, now - Date.parse(game.countdownStartedAt));
    return Math.max(1, COUNTDOWN_SECONDS - Math.floor(elapsed / 1000));
  }, [game?.countdownStartedAt, game?.phase, now]);

  useEffect(() => {
    if (game?.phase !== "countdown" || !game.countdownStartedAt) {
      if (game?.phase !== "countdown") {
        lastCountdownAnchorRef.current = null;
      }
      return;
    }

    if (lastCountdownAnchorRef.current === game.countdownStartedAt) {
      return;
    }

    lastCountdownAnchorRef.current = game.countdownStartedAt;
    playSoundEffect("countdown");
  }, [game?.phase, game?.countdownStartedAt, playSoundEffect]);

  useEffect(() => {
    if (!game?.endReason) {
      playedGameOverRef.current = false;
      return;
    }

    // Dummy plays gameOver during the local defeat sequence before defeatGame().
    if (game.endReason === "lives-depleted" && role === GameRole.Dummy) {
      return;
    }

    playGameOverOnce();
  }, [game?.endReason, playGameOverOnce, role]);

  useEffect(() => {
    if (!isDev && game && !game.activeGame && !game.endReason) {
      navigate("/");
    }
  }, [game, isDev, navigate]);

  useEffect(() => {
    if (!game || game.activeGame) {
      return;
    }

    if (game.endReason === "soundtrack-complete") {
      queueGameNotice("The dummy survived the track!");
      goToScore("dummy");
      return;
    }

    if (game.endReason === "lives-depleted") {
      goToScore("saboteur");
      return;
    }

    if (game.endReason === "role-disconnected" || game.endReason === "role-timeout") {
      queueGameNotice("A player disconnected, so the game ended.");
    } else if (game.endReason === "manual") {
      queueGameNotice("Game ended.");
    }

    navigate("/");
  }, [game, goToScore, navigate]);

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

    setDevSoloStartedAt(new Date().toISOString());
    setDevSolo(true);
  }, [hasActiveGame, devStartGame]);

  // Game controls (win / end / dev bypass) live in the global Settings menu under Dev Mode.
  // Only the game pages mount RoleGameShell, so these only appear on game screens.
  const gameDevSection = useMemo(
    () => (
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-extrabold tracking-[0.12em] text-[#a89a82] uppercase">Game</span>
        <button
          className={devMenuButton}
          type="button"
          onClick={() => {
            playGameOverOnce();
            goToScore(role);
          }}
        >
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
    [goToScore, playGameOverOnce, role, startDevSolo]
  );
  useDevSection("game", gameDevSection);

  const overlay = playing || defeatSequenceActive ? null : (
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
    <GameTempoProvider playingStartedAt={playing ? playingStartedAt : null}>
      <DefeatSequenceProvider onActiveChange={setDefeatSequenceActive}>
        <RoleGameShellView
          confirmEndOpen={confirmEndOpen}
          defeatSequenceActive={defeatSequenceActive}
          overlay={overlay}
          playing={playing}
          setConfirmEndOpen={setConfirmEndOpen}
          onConfirmEndGame={confirmEndGame}
        >
          {children}
        </RoleGameShellView>
      </DefeatSequenceProvider>
    </GameTempoProvider>
  );
}

function RoleGameShellView({
  children,
  confirmEndOpen,
  defeatSequenceActive,
  overlay,
  playing,
  setConfirmEndOpen,
  onConfirmEndGame,
}: {
  children: ReactNode;
  confirmEndOpen: boolean;
  defeatSequenceActive: boolean;
  overlay: ReactNode;
  playing: boolean;
  setConfirmEndOpen: (open: boolean) => void;
  onConfirmEndGame: () => void;
}) {
  const tempo = useGameTempo();

  return (
    <div className="relative min-h-[calc(100dvh-4.5rem)] overflow-hidden">
      <div
        className={cx(
          "transition duration-500",
          overlay != null && "pointer-events-none scale-[0.99] opacity-35 blur-[2px]"
        )}
      >
        {children}
      </div>

      {overlay}

      {playing && !defeatSequenceActive ? <TempoIndicator tempo={tempo} /> : null}

      {confirmEndOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/72 px-4 backdrop-blur-[3px]" role="dialog" aria-modal="true">
          <div className="relative z-[1] w-[min(520px,100%)] text-center">
            <p className="mt-0 mb-2 text-sm font-black tracking-normal text-[#ffd65c] uppercase">End game?</p>
            <h2 className="mt-0 mb-3 text-[clamp(2.5rem,10vw,5rem)] leading-[0.86] font-black text-white [text-shadow:0_5px_0_rgba(0,0,0,0.28)]">Everyone goes home.</h2>
            <p className="mx-auto mt-0 mb-6 max-w-[24rem] text-base leading-5 font-black text-white/82">
              This will close the active run for both screens.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button className="inline-flex min-h-13 items-center justify-center rounded-[1rem] border border-[#d93236] bg-[#ef4b4f] px-7 py-3 font-black text-white uppercase shadow-[inset_0_3px_0_rgba(255,255,255,0.42),inset_0_-3px_0_rgba(142,20,27,0.28)] [text-shadow:0_2px_0_rgba(100,10,16,0.24)]" type="button" onClick={onConfirmEndGame}>
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
      <div className={lobbyBackdrop}>
        <div className="text-center">
          <p className="m-0 text-sm font-extrabold tracking-[0.2em] text-[#ffd65c] uppercase">Get ready</p>
          <div className="mt-1 text-[clamp(7rem,26vw,15rem)] leading-none font-black text-white drop-shadow-[0_10px_0_rgba(0,0,0,0.25)] animate-[countdown-pop_0.45s_ease-out_infinite_alternate]">
            {countdownSeconds}
          </div>
        </div>
      </div>
    );
  }

  const readyCheck = hasActiveGame && hasClaimedRole && otherJoined;
  const headline = !hasActiveGame
    ? "No active game"
    : !hasClaimedRole
      ? "Joining…"
      : !otherJoined
        ? `Waiting for ${otherRoleLabel}`
        : "Ready up!";

  return (
    <div className={lobbyBackdrop}>
      <div className="pointer-events-auto w-[min(380px,100%)] rounded-[1.75rem] bg-[#fff7e8] px-7 py-8 text-center text-[#28303d] shadow-[inset_0_2px_0_rgba(255,255,255,0.7),0_24px_60px_rgba(0,0,0,0.45)]">
        <p className="m-0 text-[0.7rem] font-extrabold tracking-[0.18em] text-[#c2901f] uppercase">{roleLabel}</p>
        <h2 className="mt-1.5 mb-0 text-[clamp(1.6rem,5vw,2.1rem)] leading-tight font-black">{headline}</h2>

        <div className="mt-6 flex flex-col gap-2">
          <StatusRow label="You" joined={hasClaimedRole} ready={selfReady} />
          <StatusRow label={otherRoleLabel} joined={otherJoined} ready={otherReady} />
        </div>

        {readyCheck ? (
          <button
            className="mt-6 min-h-13 w-full rounded-[1.1rem] border border-[#ee9a06] bg-[#ffaf09] px-8 text-base font-black text-white uppercase shadow-[inset_0_3px_0_rgba(255,255,255,0.5),inset_0_-3px_0_rgba(206,120,0,0.24)] [text-shadow:0_2px_0_rgba(156,86,0,0.24)] transition hover:bg-[#f7a407] active:translate-y-0.5"
            type="button"
            onClick={onReady}
          >
            {selfReady ? "Unready" : "Ready Up"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function StatusRow({ label, joined, ready }: { label: string; joined: boolean; ready: boolean }) {
  const text = !joined ? "Waiting" : ready ? "Ready" : "Not ready";
  const dot = !joined ? "bg-[#d8cdb5]" : ready ? "bg-[#2fb86b]" : "bg-[#ffaf09]";

  return (
    <div className="flex items-center justify-between rounded-[1rem] bg-white px-4 py-3 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.05)]">
      <span className="text-sm font-extrabold text-[#28303d]">{label}</span>
      <span className="flex items-center gap-2 text-xs font-extrabold tracking-wide text-[#8a8274] uppercase">
        <span className={cx("size-2.5 rounded-full", dot)} />
        {text}
      </span>
    </div>
  );
}
