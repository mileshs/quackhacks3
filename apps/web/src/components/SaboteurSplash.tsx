import type { CSSProperties } from "react";

type SaboteurSplashProps = {
  onDismiss: () => void;
};

const TITLE = "SABOTAGE";

export function SaboteurSplash({ onDismiss }: SaboteurSplashProps) {
  return (
    <div
      className="sabotage-splash"
      role="dialog"
      aria-label="Sabotage"
      onClick={onDismiss}
    >
      <div className="sabotage-scanlines" aria-hidden="true" />
      <div className="sabotage-glow" aria-hidden="true" />

      <p className="sabotage-kicker">Mission</p>

      <h1 className="sabotage-title" data-text={TITLE}>
        {TITLE.split("").map((letter, index) => (
          <span
            key={`${letter}-${index}`}
            className="[animation-delay:var(--sabotage-letter-delay)]"
            style={{ "--sabotage-letter-delay": `${index * 0.06}s` } as CSSProperties}
          >
            {letter}
          </span>
        ))}
      </h1>

      <p className="sabotage-sub">You are the Saboteur</p>

      <button
        className="sabotage-cta"
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
