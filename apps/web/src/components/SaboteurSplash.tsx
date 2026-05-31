type SaboteurSplashProps = {
  onDismiss: () => void;
};

const TITLE = "SABOTAGE";

export function SaboteurSplash({ onDismiss }: SaboteurSplashProps) {
  return (
    <div
      className="fixed inset-0 z-1000 flex cursor-pointer flex-col items-center justify-center gap-6 overflow-hidden bg-[radial-gradient(circle_at_50%_38%,#2c0202_0%,#120000_55%,#000_100%)]"
      role="dialog"
      aria-label="Sabotage"
      onClick={onDismiss}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(to_bottom,rgba(255,255,255,0.05)_0,rgba(255,255,255,0.05)_1px,transparent_1px,transparent_3px)] opacity-50 mix-blend-overlay"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_50%_42%,rgba(255,30,30,0.35)_0%,transparent_45%)]"
        aria-hidden="true"
      />

      <p className="m-0 animate-pulse text-[clamp(0.7rem,2vw,1rem)] uppercase tracking-[0.55em] text-[#ff8a8a]">Mission</p>

      <h1 className="relative m-0 text-[clamp(3.5rem,17vw,13rem)] leading-[0.85] font-black uppercase tracking-[0.03em] text-[#ff2424] [-webkit-text-stroke:2px_rgba(255,255,255,0.06)] [text-shadow:0_0_18px_rgba(255,36,36,0.85),0_0_64px_rgba(255,0,0,0.5)]" data-text={TITLE}>
        {TITLE.split("").map((letter, index) => (
          <span className="inline-block animate-bounce" key={`${letter}-${index}`} style={{ animationDelay: `${index * 0.06}s` }}>
            {letter}
          </span>
        ))}
      </h1>

      <p className="m-0 text-[clamp(1rem,3vw,1.7rem)] font-bold uppercase tracking-[0.18em] text-[#ffd1d1]">
        You are the Saboteur
      </p>

      <button
        className="mt-2 cursor-pointer rounded-full border-2 border-white/25 bg-linear-to-b from-[#ff3636] to-[#c40d0d] px-10 py-3 text-base font-extrabold uppercase tracking-[0.2em] text-white shadow-[0_0_24px_rgba(255,40,40,0.6)] hover:from-[#ff5454] hover:to-[#e01414]"
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onDismiss();
        }}
      >
        Begin
      </button>
    </div>
  );
}
