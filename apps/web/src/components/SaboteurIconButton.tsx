import type { ReactNode } from "react";
import { cx } from "../lib/ui";

type SaboteurIconButtonProps = {
  label: string;
  description?: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: ReactNode;
};

export function SaboteurIconButton({
  label,
  description,
  onClick,
  disabled = false,
  active = false,
  children
}: SaboteurIconButtonProps) {
  return (
    <button
      type="button"
      className={cx(
        "flex w-full cursor-pointer items-center gap-2.5 rounded-lg border px-2 py-1.5 text-left transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-40",
        active
          ? "border-[#75e2be]/55 bg-[#75e2be]/15 text-white"
          : "border-white/15 bg-white/6 text-[#d8e2df] hover:border-[#75e2be]/45 hover:bg-white/10 hover:text-white"
      )}
      aria-label={description ? `${label}. ${description}` : label}
      disabled={disabled}
      onClick={onClick}
    >
      <span
        className={cx(
          "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border",
          active ? "border-[#75e2be]/35 bg-[#75e2be]/10" : "border-white/10 bg-black/20"
        )}
      >
        {children}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm leading-tight font-semibold text-[#f6f4ea]">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs leading-snug text-[#aebbb8]">{description}</span>
        ) : null}
      </span>
    </button>
  );
}

export function MakePoseIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4M9 20v-4l3-3 3 3v4M8 11h8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 5v6M16 8h6" strokeLinecap="round" />
    </svg>
  );
}

export function EditPoseIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path d="M12 20h9" strokeLinecap="round" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function RandomizePoseIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path d="M16 3h5v5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 20 21 3" strokeLinecap="round" />
      <path d="M21 16v5h-5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 15l6 6" strokeLinecap="round" />
      <path d="M4 4l5 5" strokeLinecap="round" />
    </svg>
  );
}

export function PreviewHoleIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function AddPoseIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="M12 8v8M8 12h8" strokeLinecap="round" />
    </svg>
  );
}

export function CancelPoseIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9 9 15M9 9l6 6" strokeLinecap="round" />
    </svg>
  );
}

export function SendPoseIcon() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4M9 20v-4l3-3 3 3v4M8 11h8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
