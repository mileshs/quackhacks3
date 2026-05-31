import "@fontsource/nunito/800.css";
import "@fontsource/nunito/900.css";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { readPersistedClaimedRole } from "../lib/claimedRoleStorage";
import { useRoleScopedSound } from "../hooks/useRoleScopedSound";
import {
  dummyFinalStats,
  finalResultCopy,
  saboteurFinalStats,
  type FinalStat,
  type FinalWinner
} from "../lib/finalScreen";
import { cx } from "../lib/ui";

type FinalSide = "dummy" | "saboteur";

const sideConfig = {
  dummy: {
    title: "Dummy",
    subtitle: "Athlete",
    card: "bg-[#fff4df] text-[#28303d] shadow-[inset_0_3px_0_rgba(255,255,255,0.7),inset_0_-4px_0_rgba(221,179,83,0.28)]",
    header: "bg-[#ffaf09] text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.5)]",
    accent: "text-[#c9780a]",
    avatarRing: "border-[#ffaf09] bg-[#ffe9bd]",
    avatar: "fill-[#ffaf09]",
    stats: dummyFinalStats
  },
  saboteur: {
    title: "Saboteur",
    subtitle: "Pose Maker",
    card: "bg-[#ffe4e1] text-[#3a1f23] shadow-[inset_0_3px_0_rgba(255,255,255,0.7),inset_0_-4px_0_rgba(193,72,72,0.28)]",
    header: "bg-[#ef4b4b] text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.4)]",
    accent: "text-[#c2382f]",
    avatarRing: "border-[#ef4b4b] bg-[#ffd0cc]",
    avatar: "fill-[#ef4b4b]",
    stats: saboteurFinalStats
  }
} satisfies Record<
  FinalSide,
  {
    title: string;
    subtitle: string;
    card: string;
    header: string;
    accent: string;
    avatarRing: string;
    avatar: string;
    stats: FinalStat[];
  }
>;

const darkSideConfig = {
  dummy: {
    title: "Dummy",
    subtitle: "Athlete",
    card: "bg-[#3a3634] text-[#d4d0cc] shadow-[inset_0_3px_0_rgba(255,255,255,0.06),inset_0_-4px_0_rgba(0,0,0,0.4)]",
    header: "bg-[#524c48] text-[#e8e4df] shadow-[inset_0_2px_0_rgba(255,255,255,0.08)]",
    accent: "text-[#c4a574]",
    avatarRing: "border-[#6e6862] bg-[#45413e]",
    avatar: "fill-[#9a928a]",
    stats: dummyFinalStats
  },
  saboteur: {
    title: "Saboteur",
    subtitle: "Pose Maker",
    card: "bg-[#452525] text-[#e0d4d4] shadow-[inset_0_3px_0_rgba(255,255,255,0.06),inset_0_-4px_0_rgba(0,0,0,0.45)]",
    header: "bg-[#5c1e1e] text-[#ece0e0] shadow-[inset_0_2px_0_rgba(255,255,255,0.08)]",
    accent: "text-[#e07a72]",
    avatarRing: "border-[#7a2a2a] bg-[#351a1a]",
    avatar: "fill-[#c24a4a]",
    stats: saboteurFinalStats
  }
} satisfies typeof sideConfig;

function getSideConfig(side: FinalSide, dark: boolean) {
  return dark ? darkSideConfig[side] : sideConfig[side];
}

const DUMMY_VICTORY_POSE_IMAGE = "/assets/dummy-victory-pose.png";

// Saboteur-won page keeps the original SVG silhouette.
const DUMMY_ICON_BODY =
  "M45 60c0-9 7-16 16-16h18c9 0 16 7 16 16v36h-14v44c0 7-5 12-12 12s-12-5-12-12V96h-6v44c0 7-5 12-12 12s-12-5-12-12V96H45V60Z";
const DUMMY_ICON_ARMS =
  "M48 58 23 35c-5-4-5-11-1-15s11-4 15 1l25 26-14 11Zm44 0 25-37c4-5 11-5 15-1s4 11-1 15l-25 23-14-11Z";

function FinalDecor({ dark }: { dark: boolean }) {
  const dotPattern = dark
    ? "bg-[radial-gradient(circle,rgba(0,0,0,0.45)_0_0.3rem,transparent_0.34rem)]"
    : "bg-[radial-gradient(circle,rgba(255,255,255,0.42)_0_0.3rem,transparent_0.34rem)]";

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <div
        className={cx(
          "absolute -bottom-72 -left-64 aspect-square w-[min(38vw,40rem)] rounded-full",
          dark ? "bg-black/25" : "bg-[#fff8d2]/30"
        )}
      />
      <div className={cx("absolute top-9 left-11 h-32 w-40 bg-[length:1.75rem_1.75rem] opacity-35", dotPattern)} />
      <div className={cx("absolute right-10 bottom-10 h-28 w-40 bg-[length:1.75rem_1.75rem] opacity-35", dotPattern)} />
      <span
        className={cx(
          "absolute top-[12.4%] left-[15.2%] block size-9 rounded-full border-[0.5rem] opacity-80",
          dark ? "border-black bg-black/30" : "border-[#ff9a1f]"
        )}
      />
      <span
        className={cx(
          "absolute right-[14.5%] bottom-[20.1%] block size-11 rounded-full border-[0.5rem] opacity-80",
          dark ? "border-[#1a1a1a] bg-black/25" : "border-white"
        )}
      />
      <span
        className={cx(
          "absolute right-[5.2%] top-[14.1%] block size-8 rounded-full opacity-80",
          dark ? "bg-black" : "bg-[#ffb000]"
        )}
      />
      <span
        className={cx(
          "absolute left-[8.1%] bottom-[16.4%] block size-7 rounded-full opacity-80",
          dark ? "bg-[#1a1a1a]" : "bg-[#ffae00]"
        )}
      />
    </div>
  );
}

function CharacterAvatar({ side, dark }: { side: FinalSide; dark: boolean }) {
  const config = getSideConfig(side, dark);
  const useVictoryPoseImage = side === "dummy" && !dark;

  return (
    <div
      className={cx(
        "grid aspect-square h-[clamp(3.75rem,10.5vh,6.25rem)] place-items-center overflow-hidden rounded-full",
        useVictoryPoseImage ? "border-0" : cx("border-[3px]", config.avatarRing)
      )}
      aria-hidden="true"
    >
      {side === "dummy" ? (
        dark ? (
          <svg className={cx("h-[70%] w-[70%]", config.avatar)} viewBox="0 0 140 160">
            <circle cx="70" cy="28" r="18" />
            <path d={DUMMY_ICON_BODY} />
            <path d={DUMMY_ICON_ARMS} />
          </svg>
        ) : (
          <img
            alt=""
            className="h-full w-full object-cover"
            src={DUMMY_VICTORY_POSE_IMAGE}
          />
        )
      ) : (
        <svg className={cx("h-[70%] w-[70%]", config.avatar)} viewBox="0 0 140 160">
          <>
            <path d="M70 15 101 34v39c0 35-21 59-31 66-10-7-31-31-31-66V34l31-19Z" />
            <path className={dark ? "fill-[#b8b0a8]/80" : "fill-white/80"} d="M49 58h42v12H49V58Zm10 31h22v12H59V89Z" />
            <path d="M28 114c13-6 27-7 42-7s29 1 42 7v25H28v-25Z" />
          </>
        </svg>
      )}
    </div>
  );
}

function StatGrid({ side, dark }: { side: FinalSide; dark: boolean }) {
  const config = getSideConfig(side, dark);

  return (
    <dl className="grid h-full w-full grid-cols-2 grid-rows-2 gap-2">
      {config.stats.map((stat) => (
        <div
          className={cx(
            "flex min-h-[clamp(2.75rem,6.5vh,3.75rem)] flex-col justify-center rounded-[0.85rem] px-2.5 py-2 text-center",
            dark ? "bg-[#5c5652]/70" : "bg-white/55"
          )}
          key={stat.label}
        >
          <dt
            className={cx(
              "text-[clamp(0.62rem,1.1vh,0.72rem)] font-extrabold uppercase leading-tight tracking-normal",
              dark ? "text-[#b8b0a8]" : "text-[#6c6353]"
            )}
          >
            {stat.label}
          </dt>
          <dd className={cx("m-0 mt-0.5 text-[clamp(0.95rem,2vh,1.35rem)] font-black leading-tight", config.accent)}>{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function PlayerPanel({ side, winner, dark }: { side: FinalSide; winner: FinalWinner; dark: boolean }) {
  const isWinner = winner === side;
  const config = getSideConfig(side, dark);

  return (
    <article
      className={cx(
        "relative flex min-h-[clamp(12rem,30vh,16.5rem)] flex-col gap-3 rounded-[1.4rem] p-3 transition-all duration-700 ease-out sm:p-3.5",
        config.card,
        isWinner
          ? cx(
              "z-10 translate-y-0 rotate-0 opacity-100 motion-reduce:animate-none",
              dark ? "motion-safe:animate-winner-pulse-dark" : "motion-safe:animate-winner-pulse"
            )
          : cx(
              "z-0 scale-[0.97] translate-y-[clamp(2.5rem,8vh,5.5rem)] opacity-75",
              side === "dummy" ? "-rotate-3" : "rotate-3"
            )
      )}
    >
      <div className={cx("flex shrink-0 items-center justify-between gap-2 rounded-[0.9rem] px-3 py-2", config.header)}>
        <div className="min-w-0 text-left">
          <p className="m-0 text-[clamp(0.58rem,1.1vh,0.7rem)] font-extrabold uppercase leading-none tracking-normal opacity-90">{config.subtitle}</p>
          <h2 className="mt-0.5 mb-0 text-[clamp(1.15rem,2.8vh,1.85rem)] leading-none font-black uppercase">{config.title}</h2>
        </div>
        <span
          className={cx(
            "shrink-0 rounded-full px-2.5 py-1 text-[clamp(0.58rem,1.1vh,0.7rem)] font-black uppercase tracking-normal",
            dark ? "bg-[#8a8580]/35 text-[#e8e4df]" : "bg-white/25"
          )}
        >
          {isWinner ? "Winner" : "Defeated"}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 items-center gap-3">
        <CharacterAvatar side={side} dark={dark} />
        <div className="flex min-h-0 min-w-0 flex-1 self-stretch py-0.5">
          <StatGrid side={side} dark={dark} />
        </div>
      </div>
    </article>
  );
}

export function FinalScreenPage() {
  const [searchParams] = useSearchParams();
  const initialWinner = searchParams.get("winner") === "saboteur" ? "saboteur" : "dummy";
  const [winner, setWinner] = useState<FinalWinner>(initialWinner);
  const { playSoundEffect } = useRoleScopedSound(readPersistedClaimedRole());
  const result = finalResultCopy[winner];
  const isDev = import.meta.env.DEV;

  useEffect(() => {
    playSoundEffect(winner === "dummy" ? "cheer" : "boo");
  }, [winner, playSoundEffect]);

  function toggleWinner() {
    setWinner((currentWinner) => (currentWinner === "dummy" ? "saboteur" : "dummy"));
  }

  const saboteurWon = winner === "saboteur";

  const pageBackground = saboteurWon
    ? "bg-[radial-gradient(circle_at_50%_18%,rgba(50,14,14,0.2)_0_8.5rem,rgba(35,8,8,0)_22rem),linear-gradient(145deg,#7a2222_0%,#5c1414_40%,#451010_78%,#320a0a_100%)]"
    : "bg-[radial-gradient(circle_at_50%_18%,rgba(255,248,190,0.42)_0_8.5rem,rgba(255,248,190,0)_25rem),linear-gradient(145deg,#ffe066_0%,#ffd13c_43%,#ffc127_100%)]";

  return (
    <section
      className={cx(
        "fixed inset-0 z-20 flex h-svh flex-col overflow-hidden px-[clamp(1.25rem,5vw,3.5rem)] py-[clamp(1rem,3.5vh,2.5rem)] font-[Nunito,Inter,ui-sans-serif,system-ui,sans-serif]",
        saboteurWon ? "text-[#d4d0cc]" : "text-[#28303d]",
        pageBackground
      )}
      aria-labelledby="final-title"
    >
      <FinalDecor dark={saboteurWon} />

      <header className="relative z-[2] shrink-0 text-center">
        <h1
          id="final-title"
          className={cx(
            "m-0 mb-1 text-[clamp(2.2rem,6vh,4.5rem)] leading-[0.95] font-black",
            saboteurWon
              ? "text-white [text-shadow:0_2px_0_rgba(0,0,0,0.45)]"
              : "text-[#28303d] [text-shadow:0_2px_0_rgba(255,255,255,0.45)]"
          )}
        >
          {result.title}
        </h1>
        <p
          className={cx(
            "mx-auto m-0 max-w-2xl text-[clamp(0.85rem,1.8vh,1.1rem)] font-bold",
            saboteurWon ? "text-[#b8b0a8]" : "text-[#5c5340]"
          )}
        >
          {result.description}
        </p>
      </header>

      <div className="absolute left-1/2 top-1/2 z-[2] w-[min(68rem,calc(100%-clamp(2rem,6vw,4rem)))] -translate-x-1/2 -translate-y-[calc(50%+clamp(1.25rem,3.5vh,2.75rem))] grid grid-cols-2 gap-[clamp(0.85rem,2.5vw,1.75rem)]">
        <PlayerPanel side="dummy" winner={winner} dark={saboteurWon} />
        <PlayerPanel side="saboteur" winner={winner} dark={saboteurWon} />
      </div>

      <div className="relative z-[2] mt-auto flex shrink-0 flex-wrap items-center justify-center gap-[clamp(0.6rem,1.6vh,1rem)]">
        <Link
          className={cx(
            "inline-flex min-h-[3.25rem] items-center justify-center rounded-[1.3rem] px-8 text-[clamp(1rem,1.6vw,1.25rem)] font-black uppercase tracking-normal no-underline transition duration-200 active:translate-y-1",
            saboteurWon
              ? "border border-[#3a3a3a] bg-[#524c48] text-[#e8e4df] shadow-[inset_0_3px_0_rgba(255,255,255,0.1),inset_0_-3px_0_rgba(0,0,0,0.35)] hover:bg-[#5e5854]"
              : "border border-[#ee9a06] bg-[#ffaf09] text-white shadow-[inset_0_3px_0_rgba(255,255,255,0.54),inset_0_-3px_0_rgba(206,120,0,0.22)] hover:bg-[#f7a407]"
          )}
          to="/"
        >
          Back Home
        </Link>
        {isDev ? (
          <button
            className={cx(
              "inline-flex min-h-[3.25rem] items-center justify-center rounded-[1.3rem] px-6 text-[clamp(0.85rem,1.3vw,1rem)] font-black uppercase tracking-normal transition duration-200 active:translate-y-1",
              saboteurWon
                ? "bg-[#3a3634] text-[#d4d0cc] shadow-[inset_0_2px_0_rgba(255,255,255,0.08),inset_0_-3px_0_rgba(0,0,0,0.4)] hover:bg-[#45413e]"
                : "bg-[#fff4df] text-[#28303d] shadow-[inset_0_2px_0_rgba(255,255,255,0.68),inset_0_-3px_0_rgba(221,179,83,0.22)] hover:bg-[#f8ead0]"
            )}
            type="button"
            onClick={toggleWinner}
          >
            Debug: Switch to {winner === "dummy" ? "Saboteur Won" : "Dummy Won"}
          </button>
        ) : null}
      </div>
    </section>
  );
}
