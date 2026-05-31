import type { CSSProperties } from "react";

type DummySplashProps = {
  onDismiss: () => void;
};

const TITLE = "DUMMY";

export function DummySplash({ onDismiss }: DummySplashProps) {
  return (
    <div
      className="dummy-splash"
      role="dialog"
      aria-label="Dummy mission"
      onClick={onDismiss}
    >
      <div className="dummy-glow" aria-hidden="true" />

      <p className="dummy-kicker">Mission</p>

      <h1 className="dummy-title">
        {TITLE.split("").map((letter, index) => (
          <span
            key={`${letter}-${index}`}
            style={{ "--dummy-letter-delay": `${0.35 + index * 0.06}s` } as CSSProperties}
          >
            {letter}
          </span>
        ))}
      </h1>

      <p className="dummy-sub">You are the Dummy</p>
      <p className="dummy-tagline">Get ready to pose</p>

      <button
        className="dummy-cta"
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
