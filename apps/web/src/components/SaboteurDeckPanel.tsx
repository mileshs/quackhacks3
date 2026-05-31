import { useMemo } from "react";
import { buildBlobFigure, universalHumanSize, type UniversalPose } from "@quackhacks/shared";
import { RandomizePoseIcon } from "./SaboteurIconButton";
import { cx, panel } from "../lib/ui";

const CARD_WIDTH = 72;
const CARD_HEIGHT = 88;
const THUMB_SCALE = 0.09;
const THUMB_TX = (CARD_WIDTH - universalHumanSize.width * THUMB_SCALE) / 2;
const THUMB_TY = CARD_HEIGHT - universalHumanSize.height * THUMB_SCALE - 6;

type SaboteurDeckPanelProps = {
  poses: UniversalPose[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onRandomize: () => void;
};

export function SaboteurDeckPanel({ poses, selectedIndex, onSelect, onRandomize }: SaboteurDeckPanelProps) {
  return (
    <div className={cx(panel, "flex flex-col gap-3 p-4")}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="m-0 text-sm font-extrabold tracking-wide text-[#f6f4ea] uppercase">Deck</h2>
          <p className="m-0 mt-0.5 text-[11px] text-[#8a8274]">{poses.length} cards</p>
        </div>
        <button
          type="button"
          className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-white/12 bg-black/30 text-[#d8e2df] transition-colors hover:border-[#ef5c6b]/40 hover:bg-[#ef5c6b]/10 hover:text-white"
          aria-label="Randomize pose. Load a random preset from the deck."
          onClick={onRandomize}
        >
          <RandomizePoseIcon />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {poses.map((entry, index) => (
          <DeckCard
            key={entry.id}
            pose={entry}
            selected={index === selectedIndex}
            onSelect={() => onSelect(index)}
          />
        ))}
      </div>
    </div>
  );
}

function DeckCard({
  pose,
  selected,
  onSelect
}: {
  pose: UniversalPose;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={cx(
        "flex w-[4.75rem] shrink-0 cursor-pointer flex-col gap-1 rounded-lg border p-1.5 text-left transition-colors",
        selected
          ? "border-[#ef5c6b]/70 bg-[#ef5c6b]/10"
          : "border-white/10 bg-[#121218]/60 hover:border-white/20 hover:bg-white/4"
      )}
      onClick={onSelect}
      aria-label={`Select ${pose.name}`}
      aria-pressed={selected}
    >
      <div className="relative overflow-hidden rounded-md bg-[#0a0a0c]">
        <PoseThumbnail pose={pose} />
        {selected ? (
          <span className="absolute top-1 right-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#ef5c6b] text-[10px] font-bold text-white">
            ✓
          </span>
        ) : null}
      </div>
      <span className="truncate text-[10px] leading-tight font-semibold text-[#d8e2df]">{pose.name}</span>
    </button>
  );
}

function PoseThumbnail({ pose }: { pose: UniversalPose }) {
  const jointMap = useMemo(() => new Map(pose.joints.map((joint) => [joint.name, joint])), [pose.joints]);
  const prims = useMemo(
    () => buildBlobFigure(Array.from(jointMap.values()), { color: "#5b8fd4" }),
    [jointMap]
  );

  return (
    <svg viewBox={`0 0 ${CARD_WIDTH} ${CARD_HEIGHT}`} width={CARD_WIDTH} height={CARD_HEIGHT} aria-hidden="true">
      <rect x={0} y={0} width={CARD_WIDTH} height={CARD_HEIGHT} className="fill-[#0a0a0c]" />
      <g transform={`translate(${THUMB_TX}, ${THUMB_TY}) scale(${THUMB_SCALE})`}>
        {prims.map((prim, index) => {
          if (prim.kind === "capsule") {
            return (
              <line
                key={index}
                x1={prim.a.x}
                y1={prim.a.y}
                x2={prim.b.x}
                y2={prim.b.y}
                stroke={prim.fill}
                strokeWidth={prim.width}
                strokeLinecap="round"
              />
            );
          }
          if (prim.kind === "circle") {
            return <circle key={index} cx={prim.c.x} cy={prim.c.y} r={prim.r} fill={prim.fill} />;
          }
          if (prim.kind === "ellipse") {
            return (
              <ellipse key={index} cx={prim.c.x} cy={prim.c.y} rx={prim.rx} ry={prim.ry} fill={prim.fill} />
            );
          }
          return null;
        })}
      </g>
      <line
        x1={4}
        y1={CARD_HEIGHT - 8}
        x2={CARD_WIDTH - 4}
        y2={CARD_HEIGHT - 8}
        className="stroke-[#ef5c6b] [stroke-width:2] [stroke-linecap:round]"
      />
    </svg>
  );
}
