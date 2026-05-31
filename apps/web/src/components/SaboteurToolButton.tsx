import type { ReactNode } from "react";
import { cx } from "../lib/ui";

type SaboteurToolButtonProps = {
  label: string;
  hint?: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: ReactNode;
};

export function SaboteurToolButton({
  label,
  hint,
  onClick,
  disabled = false,
  active = false,
  children
}: SaboteurToolButtonProps) {
  return (
    <button
      type="button"
      className={cx(
        "flex min-w-[5.5rem] flex-col items-center gap-1.5 rounded-xl border px-3 py-2.5 transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-35",
        active
          ? "border-[#ef5c6b]/55 bg-[#ef5c6b]/12 text-white"
          : "border-white/10 bg-[#121218]/80 text-[#d8e2df] hover:border-[#ef5c6b]/35 hover:bg-white/6 hover:text-white"
      )}
      aria-label={hint ? `${label}. ${hint}` : label}
      disabled={disabled}
      onClick={onClick}
    >
      <span
        className={cx(
          "inline-flex h-10 w-10 items-center justify-center rounded-lg border",
          active ? "border-[#ef5c6b]/35 bg-[#ef5c6b]/10" : "border-white/10 bg-black/30"
        )}
      >
        {children}
      </span>
      <span className="text-center text-[11px] leading-tight font-semibold text-[#f6f4ea]">{label}</span>
      {hint ? <span className="max-w-[6.5rem] text-center text-[10px] leading-snug text-[#8a8274]">{hint}</span> : null}
    </button>
  );
}
