import { cx } from "../lib/ui";

type SettingsToggleProps = {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  description?: string;
  className?: string;
};

export function SettingsToggle({
  id,
  label,
  checked,
  onCheckedChange,
  description,
  className
}: SettingsToggleProps) {
  const descriptionId = description ? `${id}-description` : undefined;

  return (
    <section
      className={cx(
        "flex items-center justify-between gap-3 rounded-[12px] bg-white px-3 py-2.5 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]",
        className
      )}
    >
      <div className="min-w-0">
        <label className="block text-sm leading-5 font-extrabold" htmlFor={id}>
          {label}
        </label>
        {description ? (
          <p id={descriptionId} className="m-0 mt-0.5 text-xs leading-4 font-semibold text-[#8a7d66]">
            {description}
          </p>
        ) : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={descriptionId}
        className={cx(
          "relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-0 p-0.5 shadow-[inset_0_1px_2px_rgba(80,55,0,0.22)] outline-none transition-colors duration-150 ease-out",
          "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#2b303b]",
          checked ? "bg-[#2fb86b]" : "bg-[#d8cdb5]"
        )}
        onClick={() => onCheckedChange(!checked)}
      >
        <span
          className={cx(
            "pointer-events-none block size-6 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.22),0_3px_8px_rgba(0,0,0,0.18)] transition-transform duration-150 ease-out",
            checked ? "translate-x-5" : "translate-x-0"
          )}
        />
      </button>
    </section>
  );
}
