type DummySplashProps = {
  onDismiss: () => void;
};

const TITLE = "DUMMY";

export function DummySplash({ onDismiss }: DummySplashProps) {
  return (
    <div
      className="fixed inset-0 z-1000 flex cursor-pointer flex-col items-center justify-center gap-4 overflow-hidden bg-[radial-gradient(circle_at_50%_28%,#2a2008_0%,#100c04_55%,#000_100%)]"
      role="dialog"
      aria-label="Dummy mission"
      onClick={onDismiss}
    >
      <div
        className="pointer-events-none absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_50%_36%,rgba(255,210,74,0.32)_0%,transparent_48%)]"
        aria-hidden="true"
      />

      <p className="m-0 animate-pulse text-[clamp(0.7rem,2vw,1rem)] uppercase tracking-[0.55em] text-[#ffe08a]">Mission</p>

      <h1 className="m-0 text-[clamp(3.5rem,17vw,13rem)] leading-[0.85] font-black uppercase tracking-[0.03em] text-[#ffd24a] [-webkit-text-stroke:2px_rgba(255,255,255,0.08)] [text-shadow:0_0_18px_rgba(255,210,74,0.85),0_0_64px_rgba(255,180,0,0.45)]">
        {TITLE.split("").map((letter, index) => (
          <span className="inline-block animate-bounce" key={`${letter}-${index}`} style={{ animationDelay: `${index * 0.06}s` }}>
            {letter}
          </span>
        ))}
      </h1>

      <p className="m-0 mt-2 text-[clamp(1rem,3vw,1.7rem)] font-bold uppercase tracking-[0.18em] text-[#fff0b8]">
        You are the Dummy
      </p>
      <p className="m-0 text-[clamp(0.85rem,2.2vw,1.15rem)] uppercase tracking-[0.28em] text-[#e8c860]">
        Get ready to pose
      </p>

      <button
        className="mt-3 cursor-pointer rounded-full border-2 border-white/35 bg-linear-to-b from-[#ffe566] to-[#e0a400] px-10 py-3 text-base font-extrabold uppercase tracking-[0.2em] text-[#1a1200] shadow-[0_0_24px_rgba(255,210,74,0.65)] hover:from-[#fff099] hover:to-[#ffc107]"
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
