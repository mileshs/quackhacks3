import { Link } from "react-router-dom";
import { ApiStatusPanel } from "../components/ApiStatusPanel";
import { eyebrow, heroActions, primaryAction, secondaryAction } from "../lib/ui";

export function HomePage() {
  return (
    <section className="relative grid min-h-[calc(100dvh-66px)] grid-cols-1 items-end gap-[clamp(1.2rem,4vw,4rem)] overflow-hidden px-[clamp(1rem,5vw,5rem)] py-[clamp(2rem,7vw,6rem)] min-[861px]:grid-cols-[minmax(0,1fr)_minmax(280px,420px)] min-[861px]:items-center">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(12,18,26,0.92)_0%,rgba(12,18,26,0.68)_54%,rgba(12,18,26,0.38)_100%),url('https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&w=1800&q=80')] bg-cover bg-center opacity-[0.74]" />
      <div className="relative max-w-[45rem]">
        <p className={eyebrow}>Pose wall survival</p>
        <h1 className="mt-0 mb-4 text-[clamp(3rem,8vw,6.75rem)] leading-[0.95] font-bold">QuackHacks 3</h1>
        <p className="mt-0 max-w-[44rem] text-[clamp(1.05rem,2vw,1.35rem)] leading-[1.6] text-[#e2e8de]">
          A working shell for the athlete, saboteur, realtime, camera, and leaderboard systems.
        </p>
        <div className={heroActions}>
          <Link className={primaryAction} to="/game">
            Open Game Shell
          </Link>
          <Link className={secondaryAction} to="/pose-test">
            Pose Test
          </Link>
        </div>
      </div>
      <ApiStatusPanel />
    </section>
  );
}
