import {
  DEFAULT_POWERUP_DURATION_MS,
  SABOTEUR_MOVES_PER_POWERUP,
  SABOTEUR_PERFECTS_PER_POWERUP,
  SABOTEUR_POWERUP_DEFINITIONS,
  type SaboteurPowerupKind,
  type SaboteurPowerupSlot
} from "@quackhacks/shared";
import { cx, pillDanger, saboteurCard, saboteurLabel, saboteurPillSecondary, saboteurSurface } from "../lib/ui";

type SaboteurPowerupPanelProps = {
  inventory: SaboteurPowerupSlot[];
  perfectStreak: number;
  movesSinceGrant: number;
  /** Dev-only sections (progress tracker + reward simulators) only render when true. */
  showDevSections?: boolean;
  onActivate: (slotId: string) => void;
  onSimulatePerfect?: () => void;
  onSimulateMove?: () => void;
};

export function SaboteurPowerupPanel({
  inventory,
  perfectStreak,
  movesSinceGrant,
  showDevSections = false,
  onActivate,
  onSimulatePerfect,
  onSimulateMove
}: SaboteurPowerupPanelProps) {
  const durationLabel = `${(DEFAULT_POWERUP_DURATION_MS / 1000).toFixed(1)}s`;

  return (
    <div className={cx(saboteurCard, "flex min-h-0 flex-1 flex-col gap-3 p-4")}>
      <h2 className={cx(saboteurLabel, "m-0 shrink-0")}>Sabotage Tools</h2>

      <div className={cx(saboteurSurface, "flex min-h-0 flex-1 flex-col gap-1.5 p-2.5")}>
        {inventory.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-3 py-6 text-center text-xs font-semibold text-[#8b919c]">
            Earn tools from perfect streaks and pose moves.
          </div>
        ) : (
          inventory.map((slot) => (
            <ToolRow key={slot.id} slot={slot} durationLabel={durationLabel} onActivate={onActivate} />
          ))
        )}
      </div>

      {showDevSections ? (
        <div className={cx(saboteurSurface, "flex shrink-0 flex-col gap-2 p-3")}>
          <span className={saboteurLabel}>Your Progress</span>
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
      ) : null}

      {showDevSections && (onSimulatePerfect || onSimulateMove) ? (
        <div className="flex shrink-0 flex-col gap-1.5">
          <span className={saboteurLabel}>Next Rewards</span>
          <div className="flex gap-2">
            {onSimulatePerfect ? (
              <button className={cx(saboteurPillSecondary, "min-h-0 flex-1 px-3 py-2 text-xs")} type="button" onClick={onSimulatePerfect}>
                +1 PERFECT
              </button>
            ) : null}
            {onSimulateMove ? (
              <button className={cx(saboteurPillSecondary, "min-h-0 flex-1 px-3 py-2 text-xs")} type="button" onClick={onSimulateMove}>
                +1 Move
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ToolRow({
  slot,
  durationLabel,
  onActivate
}: {
  slot: SaboteurPowerupSlot;
  durationLabel: string;
  onActivate: (slotId: string) => void;
}) {
  const def = SABOTEUR_POWERUP_DEFINITIONS[slot.kind];

  return (
    <div className="flex items-center gap-2 rounded-[12px] bg-[#3a3f4a] px-2 py-1.5 text-[#ece8e0]">
      <PowerupIcon kind={slot.kind} compact />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <strong className="truncate text-xs">{def.name}</strong>
          <span className="shrink-0 text-[10px] font-semibold text-[#8b919c]">{durationLabel}</span>
        </div>
        <p className="m-0 truncate text-[10px] font-medium text-[#8b919c]">{def.description}</p>
      </div>
      <button
        className={cx(pillDanger, "min-h-0 shrink-0 rounded-[12px] px-2.5 py-1.5 text-[11px]")}
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
      <span className="text-[11px] font-semibold text-[#8b919c]">{label}</span>
      <div className="h-2 overflow-hidden rounded-full bg-[#1a1d24] shadow-[inset_0_1px_2px_rgba(0,0,0,0.45)]">
        <div
          className={cx("h-full rounded-full transition-[width]", tone === "perfect" ? "bg-[#2fb86b]" : "bg-[#ef5c6b]")}
          style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
        />
      </div>
    </div>
  );
}

export function PowerupIcon({ compact = false }: { kind?: SaboteurPowerupKind; compact?: boolean }) {
  const size = compact ? 22 : 28;
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
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="1.4"
      />
      <path d="M16 5v21.5" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
      <ellipse cx="11.5" cy="13.5" rx="2.1" ry="1.6" fill="#141414" />
      <ellipse cx="20.5" cy="13.5" rx="2.1" ry="1.6" fill="#f6f4ea" />
    </svg>
  );
}
