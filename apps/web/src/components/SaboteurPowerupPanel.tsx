import {
  DEFAULT_POWERUP_DURATION_MS,
  SABOTEUR_MAX_POWERUP_INVENTORY,
  SABOTEUR_MOVES_PER_POWERUP,
  SABOTEUR_PERFECTS_PER_POWERUP,
  SABOTEUR_POWERUP_DEFINITIONS,
  type SaboteurPowerupKind,
  type SaboteurPowerupSlot
} from "@quackhacks/shared";
import { cx, panel, primaryAction, secondaryAction } from "../lib/ui";

const POWERUP_ORDER: SaboteurPowerupKind[] = ["blindness", "mirror"];

type SaboteurPowerupPanelProps = {
  inventory: SaboteurPowerupSlot[];
  perfectStreak: number;
  movesSinceGrant: number;
  onActivate: (slotId: string) => void;
  onSimulatePerfect?: () => void;
  onSimulateMove?: () => void;
};

export function SaboteurPowerupPanel({
  inventory,
  perfectStreak,
  movesSinceGrant,
  onActivate,
  onSimulatePerfect,
  onSimulateMove
}: SaboteurPowerupPanelProps) {
  const durationLabel = `${(DEFAULT_POWERUP_DURATION_MS / 1000).toFixed(1)}s`;
  const slots = Array.from({ length: SABOTEUR_MAX_POWERUP_INVENTORY }, (_, index) => inventory[index] ?? null);

  return (
    <div className={cx(panel, "flex flex-col gap-3 p-4")}>
      <h2 className="m-0 text-sm font-extrabold tracking-wide text-[#f6f4ea] uppercase">Powerups</h2>

      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-extrabold tracking-wide text-[#aebbb8] uppercase">Equipped</span>
        <div className="flex flex-col gap-1">
          {slots.map((slot, index) => (
            <EquippedRow
              key={slot?.id ?? `empty-${index}`}
              slot={slot}
              durationLabel={durationLabel}
              onActivate={onActivate}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-extrabold tracking-wide text-[#aebbb8] uppercase">Available</span>
        {POWERUP_ORDER.map((kind) => (
          <CatalogEntry key={kind} kind={kind} durationLabel={durationLabel} />
        ))}
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-white/8 bg-black/25 p-3">
        <span className="text-[11px] font-extrabold tracking-wide text-[#aebbb8] uppercase">Your Progress</span>
        <ProgressTrack
          label={`PERFECT streak ${perfectStreak} / ${SABOTEUR_PERFECTS_PER_POWERUP}`}
          value={perfectStreak}
          max={SABOTEUR_PERFECTS_PER_POWERUP}
          tone="perfect"
        />
        <ProgressTrack
          label={`Moves ${movesSinceGrant} / ${SABOTEUR_MOVES_PER_POWERUP}`}
          value={movesSinceGrant}
          max={SABOTEUR_MOVES_PER_POWERUP}
          tone="moves"
        />
      </div>

      {onSimulatePerfect || onSimulateMove ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-extrabold tracking-wide text-[#aebbb8] uppercase">Next Rewards</span>
          <div className="flex gap-2">
            {onSimulatePerfect ? (
              <button className={cx(secondaryAction, "flex-1 text-xs")} type="button" onClick={onSimulatePerfect}>
                +1 PERFECT
              </button>
            ) : null}
            {onSimulateMove ? (
              <button className={cx(secondaryAction, "flex-1 text-xs")} type="button" onClick={onSimulateMove}>
                +1 Move
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EquippedRow({
  slot,
  durationLabel,
  onActivate
}: {
  slot: SaboteurPowerupSlot | null;
  durationLabel: string;
  onActivate: (slotId: string) => void;
}) {
  if (!slot) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-dashed border-white/12 px-2 py-2 text-xs text-[#8a8274]">
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-white/8 bg-black/20 text-[10px]">
          —
        </span>
        <span className="flex-1">Empty slot</span>
      </div>
    );
  }

  const def = SABOTEUR_POWERUP_DEFINITIONS[slot.kind];

  return (
    <div className="flex items-center gap-2 rounded-md border border-white/12 bg-white/4 px-2 py-1.5">
      <PowerupIcon kind={slot.kind} compact />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <strong className="truncate text-xs">{def.name}</strong>
          <span className="shrink-0 text-[10px] text-[#aebbb8]">{durationLabel}</span>
        </div>
      </div>
      <button
        className={cx(primaryAction, "shrink-0 px-2.5 py-1.5 text-[11px]")}
        type="button"
        onClick={() => onActivate(slot.id)}
      >
        Deploy
      </button>
    </div>
  );
}

function ProgressTrack({
  label,
  value,
  max,
  tone
}: {
  label: string;
  value: number;
  max: number;
  tone: "perfect" | "moves";
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] text-[#aebbb8]">{label}</span>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className={cx("h-full rounded-full transition-[width]", tone === "perfect" ? "bg-[#ffd65c]" : "bg-[#ef5c6b]")}
          style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
        />
      </div>
    </div>
  );
}

function CatalogEntry({ kind, durationLabel }: { kind: SaboteurPowerupKind; durationLabel: string }) {
  const def = SABOTEUR_POWERUP_DEFINITIONS[kind];

  return (
    <div className="flex gap-2.5 rounded-lg border border-white/8 bg-[#121218]/50 p-2.5">
      <PowerupIcon kind={kind} />
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-2">
          <strong className="text-sm text-[#f6f4ea]">{def.name}</strong>
          <span className="shrink-0 text-[11px] text-[#8a8274]">{durationLabel}</span>
        </div>
        <p className="m-0 mt-0.5 text-[11px] leading-snug text-[#8a8274]">{def.description}</p>
      </div>
    </div>
  );
}

export function PowerupIcon({ kind, compact = false }: { kind: SaboteurPowerupKind; compact?: boolean }) {
  const size = compact ? 22 : 28;

  if (kind === "blindness") {
    return (
      <svg className="shrink-0 text-[#ef5c6b]" viewBox="0 0 32 32" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        <ellipse cx="16" cy="16" rx="12" ry="8" />
        <circle cx="16" cy="16" r="3" fill="currentColor" stroke="none" />
        <path d="M6 6l20 20" strokeLinecap="round" />
      </svg>
    );
  }

  return <MirrorMaskIcon size={size} />;
}

function MirrorMaskIcon({ size }: { size: number }) {
  return (
    <svg className="shrink-0" viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <path d="M16 5C10.5 5 7.5 8.5 7.5 14c0 3.8 1.8 8.2 4.2 10.6 1.4 1.3 2.8 1.9 4.3 1.9V5Z" fill="#f6f4ea" />
      <path d="M16 5c5.5 0 8.5 3.5 8.5 9s-1.8 8.2-4.2 10.6c-1.4 1.3-2.8 1.9-4.3 1.9V5Z" fill="#141414" />
      <path
        d="M16 5C10.5 5 7.5 8.5 7.5 14c0 3.8 1.8 8.2 4.2 10.6 1.4 1.3 2.8 1.9 4.3 1.9 1.5 0 2.9-.6 4.3-1.9 2.4-2.4 4.2-6.8 4.2-10.6 0-5.5-3-9-8.5-9Z"
        fill="none"
        stroke="rgba(255,255,255,0.45)"
        strokeWidth="1.2"
      />
      <path d="M16 5v21.5" stroke="rgba(255,255,255,0.35)" strokeWidth="0.8" />
      <ellipse cx="11.5" cy="13.5" rx="2.1" ry="1.6" fill="#141414" />
      <ellipse cx="20.5" cy="13.5" rx="2.1" ry="1.6" fill="#f6f4ea" />
    </svg>
  );
}
