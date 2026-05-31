import { BEATS_PER_CYCLE, phaseForCount, type TempoState } from "../lib/tempo";
import { cx } from "../lib/ui";

// Phase tint for each count: rest = calm blue, pose = "go" green, snapshot = gold flash.
const PHASE_COLOR = {
  rest: "#64b4ff",
  pose: "#2fb86b",
  snapshot: "#ffd65c"
} as const;

/**
 * The shared 8-count indicator shown on both the dummy and saboteur screens. Eight dots,
 * tinted by their phase zone, with the current count enlarged and lit.
 */
export function TempoIndicator({ tempo }: { tempo: TempoState | null }) {
  if (!tempo) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed top-3 left-1/2 z-[45] flex -translate-x-1/2 items-center font-[Nunito,Inter,ui-sans-serif,system-ui,sans-serif]">
      <div className="flex items-center gap-2 rounded-full bg-[#0c0f14]/55 px-4 py-2.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1),0_8px_22px_rgba(0,0,0,0.4)] backdrop-blur-md">
        {Array.from({ length: BEATS_PER_CYCLE }).map((_, index) => {
          const count = index + 1;
          const active = count === tempo.count;
          const color = PHASE_COLOR[phaseForCount(count)];
          return (
            <span
              key={count}
              className={cx(
                "block rounded-full transition-all duration-150",
                active ? "size-3.5" : "size-2.5 opacity-40"
              )}
              style={{
                backgroundColor: color,
                boxShadow: active ? `0 0 12px ${color}, 0 0 4px ${color}` : "none"
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
