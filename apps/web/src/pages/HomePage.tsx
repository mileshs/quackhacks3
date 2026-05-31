import "@fontsource/nunito/800.css";
import "@fontsource/nunito/900.css";
import { Link, useNavigate } from "react-router-dom";
import { cx, secondaryAction } from "../lib/ui";
import { useActiveGame } from "../lib/useActiveGame";

type HomeIcon = "pose" | "trophy" | "gear";

const secondaryMenuItems: Array<{ to: string; label: string; icon: HomeIcon; tone: "light" }> = [
  { to: "/leaderboard", label: "Leaderboard", icon: "trophy", tone: "light" },
  { to: "/settings", label: "Settings", icon: "gear", tone: "light" }
];

const menuButtonBase =
  "relative grid min-h-[4.85rem] grid-cols-[6.5rem_1fr] items-center rounded-[1.55rem] px-7 py-2 pl-3 text-[clamp(1.34rem,1.7vw,1.8rem)] leading-none font-black tracking-normal uppercase no-underline transition duration-200 hover:brightness-95 active:translate-y-1 min-[1181px]:grid-cols-[7.45rem_1fr] min-[1181px]:rounded-[1.72rem] min-[1181px]:text-[clamp(1.45rem,1.84vw,1.8rem)]";

const menuButtonTone = {
  primary:
    "border border-[#ee9a06] bg-[#ffaf09] text-white shadow-[inset_0_3px_0_rgba(255,255,255,0.54),inset_0_-3px_0_rgba(206,120,0,0.22)] [text-shadow:0_2px_0_rgba(156,86,0,0.24)] hover:bg-[#f7a407]",
  light:
    "bg-[#fff4df] text-[#28303d] shadow-[inset_0_2px_0_rgba(255,255,255,0.68),inset_0_-3px_0_rgba(221,179,83,0.22)] [text-shadow:0_1px_0_rgba(255,255,255,0.45)] hover:bg-[#f8ead0]"
} satisfies Record<"primary" | "light", string>;

function MenuIcon({ icon }: { icon: HomeIcon }) {
  if (icon === "pose") {
    return <img className="block size-14 object-contain" src="/new-game-icon.png" alt="" aria-hidden="true" />;
  }

  if (icon === "trophy") {
    return (
      <svg className="size-12 overflow-visible" viewBox="0 0 64 64" aria-hidden="true">
        <defs>
          <linearGradient id="trophy-fill" x1="0" x2="0" y1="10" y2="61" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ff9d27" />
            <stop offset="0.58" stopColor="#ff8217" />
            <stop offset="1" stopColor="#ed6d0e" />
          </linearGradient>
        </defs>
        <path
          fill="url(#trophy-fill)"
          d="M19 12h26v7h8.5a4 4 0 0 1 4 4v4c0 8.5-6.1 15.4-14.1 17a16 16 0 0 1-7.3 5.2V54h9.2a3.4 3.4 0 0 1 0 6.8H18.7a3.4 3.4 0 0 1 0-6.8h9.2v-4.8a16 16 0 0 1-7.3-5.2c-8-1.6-14.1-8.5-14.1-17v-4a4 4 0 0 1 4-4H19v-7Zm0 14v-.5h-5.2V27c0 3.7 2.2 6.9 5.4 8.2-.1-1.2-.2-2.5-.2-3.8V26Zm25.8 9.2c3.2-1.3 5.4-4.5 5.4-8.2v-1.5H45v.5v5.4c0 1.3-.1 2.6-.2 3.8Z"
        />
      </svg>
    );
  }

  return (
    <svg className="size-12 overflow-visible" viewBox="0 0 64 64" aria-hidden="true">
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

  function openGame() {
    if (!isGameActive) {
      startGame();
    }

    navigate("/game");
  }

  return (
    <section
      className="fixed inset-0 z-20 grid min-h-svh items-start justify-items-center overflow-hidden bg-[radial-gradient(circle_at_50%_23%,rgba(255,248,190,0.42)_0_8.5rem,rgba(255,248,190,0)_25rem),radial-gradient(circle_at_98%_-10%,rgba(255,248,210,0.3)_0_16rem,rgba(255,248,210,0)_16.08rem),linear-gradient(145deg,#ffe066_0%,#ffd13c_43%,#ffc127_100%)] font-[Nunito,Inter,ui-sans-serif,system-ui,sans-serif] text-[#28303d] before:absolute before:inset-0 before:bg-[radial-gradient(circle,rgba(255,255,255,0.16)_0_1px,transparent_1.45px),linear-gradient(105deg,rgba(255,247,171,0.22),transparent_42%)] before:bg-[length:17px_17px,100%_100%] before:opacity-[0.48]"
      aria-labelledby="home-title"
    >
      <HomeDecor />
      <div className="relative z-[2] mt-[clamp(4.6rem,10.8vh,6.6rem)] grid w-[min(31vw,500px)] min-w-[370px] justify-items-center max-[430px]:min-w-[calc(100vw-2rem)]">
        <h1 id="home-title" className="sr-only">
          Poses for Dummies
        </h1>
        <img
          className="block w-[clamp(390px,28.7vw,485px)] max-w-full drop-shadow-[0_16px_13px_rgba(143,101,11,0.24)]"
          src="/poses-for-dummies-logo.png"
          alt="Poses for Dummies"
        />
        <nav className="mt-[clamp(1.15rem,2.7vh,1.65rem)] grid w-[clamp(370px,24.2vw,406px)] max-w-full gap-[clamp(1.15rem,2.6vh,1.55rem)]" aria-label="Home">
          <button className={cx(menuButtonBase, menuButtonTone.primary)} type="button" onClick={openGame}>
            <span className="grid size-[3.75rem] place-items-center justify-self-center drop-shadow-sm">
              <MenuIcon icon="pose" />
            </span>
            <span>{isGameActive ? "Join Game" : "New Game"}</span>
          </button>
          {isGameActive ? (
            <button className={cx(secondaryAction, "min-h-[3.5rem] text-[1.08rem] uppercase")} type="button" onClick={endGame}>
              End Game
            </button>
          ) : null}
          {secondaryMenuItems.map((item) => (
            <Link key={item.to} className={cx(menuButtonBase, menuButtonTone[item.tone])} to={item.to}>
              <span className="grid size-[3.75rem] place-items-center justify-self-center text-[#ff8217]">
                <MenuIcon icon={item.icon} />
              </span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </section>
  );
}
