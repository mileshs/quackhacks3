import "@fontsource/nunito/800.css";
import "@fontsource/nunito/900.css";
import { useEffect } from "react";
import { GameRole } from "@quackhacks/shared";
import { useNavigate } from "react-router-dom";
import { flushQueuedGameNotice } from "../lib/gameNotifications";
import { cx } from "../lib/ui";
import { useActiveGame } from "../lib/useActiveGame";

type HomeIcon = "pose" | "stop" | "gear";

const menuButtonBase =
  "relative grid min-h-[4.85rem] grid-cols-[5.85rem_minmax(0,1fr)] items-center rounded-[1.55rem] px-7 py-2 pl-2 text-left text-[clamp(1.22rem,1.55vw,1.62rem)] leading-none font-black tracking-normal uppercase no-underline transition duration-200 hover:brightness-95 active:translate-y-1 [&>span:last-child]:justify-self-start [&>span:last-child]:whitespace-nowrap min-[1181px]:grid-cols-[6.8rem_minmax(0,1fr)] min-[1181px]:rounded-[1.72rem] min-[1181px]:text-[clamp(1.32rem,1.68vw,1.64rem)]";

const menuButtonTone = {
  primary:
    "border border-[#ee9a06] bg-[#ffaf09] text-white shadow-[inset_0_3px_0_rgba(255,255,255,0.54),inset_0_-3px_0_rgba(206,120,0,0.22)] [text-shadow:0_2px_0_rgba(156,86,0,0.24)] hover:bg-[#f7a407]",
  danger:
    "border border-[#d93236] bg-[#ef4b4f] text-white shadow-[inset_0_3px_0_rgba(255,255,255,0.42),inset_0_-3px_0_rgba(142,20,27,0.28)] [text-shadow:0_2px_0_rgba(100,10,16,0.24)] hover:bg-[#df3e43]",
  light:
    "bg-[#fff4df] text-[#28303d] shadow-[inset_0_2px_0_rgba(255,255,255,0.68),inset_0_-3px_0_rgba(221,179,83,0.22)] [text-shadow:0_1px_0_rgba(255,255,255,0.45)] hover:bg-[#f8ead0]"
} satisfies Record<"primary" | "danger" | "light", string>;

function MenuIcon({ icon }: { icon: HomeIcon }) {
  if (icon === "pose") {
    return <img className="block size-[3.25rem] object-contain" src="/new-game-icon.png" alt="" aria-hidden="true" />;
  }

  if (icon === "stop") {
    return (
      <svg className="size-[2.8rem] overflow-visible" viewBox="0 0 64 64" aria-hidden="true">
        <path
          fill="#fff6ec"
          d="M22 8h20l14 14v20L42 56H22L8 42V22L22 8Zm2.6 12.2a4.4 4.4 0 0 0-4.4 4.4v14.8a4.4 4.4 0 0 0 4.4 4.4h14.8a4.4 4.4 0 0 0 4.4-4.4V24.6a4.4 4.4 0 0 0-4.4-4.4H24.6Z"
        />
        <rect x="24" y="24" width="16" height="16" rx="3.8" fill="#d93236" />
      </svg>
    );
  }

  return (
    <svg className="size-[2.8rem] overflow-visible" viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="gear-fill" x1="0" x2="0" y1="6" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ff9d27" />
          <stop offset="0.58" stopColor="#ff8217" />
          <stop offset="1" stopColor="#ed6d0e" />
        </linearGradient>
      </defs>
      <path
        fill="url(#gear-fill)"
        fillRule="evenodd"
        d="M28.6 6.5h6.8l1.3 7.3a19.4 19.4 0 0 1 5.1 2.1l6.1-4.2 4.8 4.8-4.2 6.1a19.4 19.4 0 0 1 2.1 5.1l7.3 1.3v6.8l-7.3 1.3a19.4 19.4 0 0 1-2.1 5.1l4.2 6.1-4.8 4.8-6.1-4.2a19.4 19.4 0 0 1-5.1 2.1l-1.3 7.3h-6.8L27.3 51a19.4 19.4 0 0 1-5.1-2.1l-6.1 4.2-4.8-4.8 4.2-6.1a19.4 19.4 0 0 1-2.1-5.1l-7.3-1.3V29l7.3-1.3a19.4 19.4 0 0 1 2.1-5.1l-4.2-6.1 4.8-4.8 6.1 4.2a19.4 19.4 0 0 1 5.1-2.1l1.3-7.3ZM32 42.4A10.4 10.4 0 1 0 32 21.6a10.4 10.4 0 0 0 0 20.8Zm0-6.3a4.1 4.1 0 1 0 0-8.2 4.1 4.1 0 0 0 0 8.2Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function HomeDecor() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <div className="absolute -bottom-70 -left-64 aspect-square w-[min(38vw,40rem)] rounded-full bg-[#fff8d2]/30" />
      <div className="absolute top-9 left-11 h-34 w-42 bg-[radial-gradient(circle,rgba(255,255,255,0.42)_0_0.3rem,transparent_0.34rem)] bg-[length:1.75rem_1.75rem] opacity-35" />
      <div className="absolute bottom-11 left-8 h-26 w-35 bg-[radial-gradient(circle,rgba(255,255,255,0.42)_0_0.3rem,transparent_0.34rem)] bg-[length:1.75rem_1.75rem] opacity-35" />
      <div className="absolute right-10 bottom-10 h-28 w-40 bg-[radial-gradient(circle,rgba(255,255,255,0.42)_0_0.3rem,transparent_0.34rem)] bg-[length:1.75rem_1.75rem] opacity-35" />
      <span className="absolute top-[14.4%] left-[17.2%] block size-10 rounded-full border-[0.55rem] border-[#ff9a1f] opacity-85" />
      <span className="absolute right-[16.5%] bottom-[24.1%] block size-12 rounded-full border-[0.55rem] border-white opacity-85" />
      <span className="absolute right-[4.2%] top-[12.1%] block size-9 rounded-full bg-[#ffb000] opacity-85" />
      <span className="absolute right-[24.1%] bottom-[12.4%] block size-7 rounded-full bg-[#ffae00] opacity-85" />
      <span className="absolute right-[11.5%] top-[37.5%] block h-10 w-11 rounded-sm bg-[#ff8a18] [clip-path:polygon(50%_0,100%_90%,0_90%)]" />
      <svg className="absolute -right-3 -bottom-2 h-56 w-96 opacity-45" viewBox="0 0 360 180" preserveAspectRatio="none">
        <path
          d="M8 178C74 82 133 139 188 70C235 13 288 11 354 8"
          fill="none"
          stroke="rgba(255,255,255,0.62)"
          strokeDasharray="14 18"
          strokeLinecap="round"
          strokeWidth="4"
        />
      </svg>
    </div>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const { game, startGame, endGame } = useActiveGame();
  const isGameActive = game?.activeGame ?? false;
  const isDummyTaken = game?.roles[GameRole.Dummy].status === "occupied";
  const isSaboteurTaken = game?.roles[GameRole.Saboteur].status === "occupied";
  const isGameFull = isDummyTaken && isSaboteurTaken;

  useEffect(() => {
    flushQueuedGameNotice();
  }, []);

  function joinRole(role: GameRole) {
    if (role === GameRole.Saboteur && !isSaboteurTaken) {
      navigate("/saboteur");
    }

    if (role === GameRole.Dummy && !isDummyTaken) {
      navigate("/pose-test");
    }
  }

  function createGame() {
    startGame();
  }

  return (
    <section
      className="fixed inset-0 z-20 grid min-h-svh items-center justify-items-center overflow-hidden bg-[radial-gradient(circle_at_50%_23%,rgba(255,248,190,0.42)_0_8.5rem,rgba(255,248,190,0)_25rem),radial-gradient(circle_at_98%_-10%,rgba(255,248,210,0.3)_0_16rem,rgba(255,248,210,0)_16.08rem),linear-gradient(145deg,#ffe066_0%,#ffd13c_43%,#ffc127_100%)] px-4 font-[Nunito,Inter,ui-sans-serif,system-ui,sans-serif] text-[#28303d] before:absolute before:inset-0 before:bg-[radial-gradient(circle,rgba(255,255,255,0.16)_0_1px,transparent_1.45px),linear-gradient(105deg,rgba(255,247,171,0.22),transparent_42%)] before:bg-[length:17px_17px,100%_100%] before:opacity-[0.48]"
      aria-labelledby="home-title"
    >
      <HomeDecor />
      <div className="relative z-[2] grid w-[min(31vw,500px)] min-w-[370px] justify-items-center max-[430px]:min-w-[calc(100vw-2rem)]">
        <h1 id="home-title" className="sr-only">
          Poses for Dummies
        </h1>
        <img
          className="block w-[clamp(360px,27vw,455px)] max-w-full drop-shadow-[0_16px_13px_rgba(143,101,11,0.24)]"
          src="/poses-for-dummies-logo-ai.png"
          alt="Poses for Dummies"
        />
        <nav className="mt-[clamp(1.15rem,2.7vh,1.65rem)] grid w-[clamp(370px,24.2vw,406px)] max-w-full gap-[clamp(1.15rem,2.6vh,1.55rem)]" aria-label="Home">
          {!isGameActive ? (
            <button className={cx(menuButtonBase, menuButtonTone.primary)} type="button" onClick={createGame}>
              <span className="grid size-[3.45rem] place-items-center justify-self-center drop-shadow-sm">
                <MenuIcon icon="pose" />
              </span>
              <span>New Game</span>
            </button>
          ) : null}
          {isGameActive ? (
            <button
              className={cx(menuButtonBase, menuButtonTone.primary, isSaboteurTaken && "cursor-not-allowed opacity-55")}
              type="button"
              onClick={() => joinRole(GameRole.Saboteur)}
              disabled={isSaboteurTaken}
            >
              <span className="grid size-[3.45rem] place-items-center justify-self-center drop-shadow-sm">
                <MenuIcon icon="pose" />
              </span>
              <span>{isSaboteurTaken ? "Saboteur Taken" : "Saboteur"}</span>
            </button>
          ) : null}
          {isGameActive ? (
            <button
              className={cx(menuButtonBase, menuButtonTone.primary, isDummyTaken && "cursor-not-allowed opacity-55")}
              type="button"
              onClick={() => joinRole(GameRole.Dummy)}
              disabled={isDummyTaken}
            >
              <span className="grid size-[3.45rem] place-items-center justify-self-center drop-shadow-sm">
                <MenuIcon icon="pose" />
              </span>
              <span>{isDummyTaken ? "Dummy Taken" : "Dummy"}</span>
            </button>
          ) : null}
          {isGameActive && isGameFull ? (
            <button className={cx(menuButtonBase, menuButtonTone.light, "cursor-not-allowed opacity-70")} type="button" disabled>
              <span className="grid size-[3.45rem] place-items-center justify-self-center drop-shadow-sm">
                <MenuIcon icon="stop" />
              </span>
              <span>Game Full</span>
            </button>
          ) : null}
          {isGameActive ? (
            <button className={cx(menuButtonBase, menuButtonTone.danger)} type="button" onClick={endGame}>
              <span className="grid size-[3.45rem] place-items-center justify-self-center drop-shadow-sm">
                <MenuIcon icon="stop" />
              </span>
              <span>End Game</span>
            </button>
          ) : null}
        </nav>
      </div>
    </section>
  );
}
