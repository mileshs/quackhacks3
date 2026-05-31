import type { ReactNode } from "react";
import { cx, saboteurTile } from "../lib/ui";

type SaboteurToolButtonProps = {
  label: string;
  hint?: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  /** Horizontal pill layout for the stage bottom bar. */
  compact?: boolean;
  children: ReactNode;
};

export function SaboteurToolButton({
  label,
  hint,
  onClick,
  disabled = false,
  active = false,
  compact = false,
  children
}: SaboteurToolButtonProps) {
  if (compact) {
    return (
      <button
        type="button"
        className={cx(
          "inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-[12px] px-3 py-2 text-sm font-extrabold transition-transform active:translate-y-px",
          "disabled:cursor-not-allowed disabled:opacity-40",
          active
            ? "bg-[#ef5c6b] text-white shadow-[inset_0_1.5px_0_rgba(255,255,255,0.35),0_2px_3px_rgba(0,0,0,0.18),0_6px_12px_rgba(150,25,40,0.4)]"
            : cx(saboteurTile, "transition-transform")
        )}
        aria-label={hint ? `${label}. ${hint}` : label}
        disabled={disabled}
        onClick={onClick}
      >
        <span className={cx("inline-flex shrink-0 items-center justify-center", active ? "text-white" : "text-[#ece8e0]")}>
          {children}
        </span>
        <span className={active ? "text-white" : "text-[#ece8e0]"}>{label}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className={cx(
        "flex min-w-22 cursor-pointer flex-col items-center gap-1.5 rounded-[14px] px-3 py-2.5 transition-transform active:translate-y-px",
        "disabled:cursor-not-allowed disabled:opacity-40",
        active
          ? "bg-[#ef5c6b] text-white shadow-[inset_0_1.5px_0_rgba(255,255,255,0.35),0_2px_3px_rgba(0,0,0,0.18),0_8px_16px_rgba(150,25,40,0.45)]"
          : cx(saboteurTile, "transition-transform")
      )}
      aria-label={hint ? `${label}. ${hint}` : label}
      disabled={disabled}
      onClick={onClick}
    >
      <span
        className={cx(
          "inline-flex h-10 w-10 items-center justify-center rounded-[10px]",
          active ? "bg-white/25 text-white" : "bg-[#252830] text-[#ece8e0]"
        )}
      >
        {children}
      </span>
      <span className={cx("text-center text-[11px] leading-tight font-extrabold", active ? "text-white" : "text-[#ece8e0]")}>{label}</span>
      {hint ? <span className={cx("max-w-26 text-center text-[10px] leading-snug font-semibold", active ? "text-white/80" : "text-[#8b919c]")}>{hint}</span> : null}
    </button>
  );
}
