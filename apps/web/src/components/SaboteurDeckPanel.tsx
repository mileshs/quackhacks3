import { useMemo } from "react";
import { buildBlobFigure, universalHumanSize, type UniversalPose } from "@quackhacks/shared";
import { RandomizePoseIcon } from "./SaboteurIconButton";
import { cx, saboteurCard, saboteurLabel, saboteurSurface, saboteurTile } from "../lib/ui";

const CARD_WIDTH = 116;
const CARD_HEIGHT = 144;
const THUMB_SCALE = 0.15;
const THUMB_TX = (CARD_WIDTH - universalHumanSize.width * THUMB_SCALE) / 2;
const THUMB_TY = CARD_HEIGHT - universalHumanSize.height * THUMB_SCALE - 8;

type SaboteurDeckPanelProps = {
  poses: UniversalPose[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onRandomize: () => void;
};

export function SaboteurDeckPanel({ poses, selectedIndex, onSelect, onRandomize }: SaboteurDeckPanelProps) {
  return (
    <div className={cx(saboteurCard, "flex flex-col gap-3 p-4")}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className={cx(saboteurLabel, "m-0")}>Deck</h2>
          <p className="m-0 mt-0.5 text-[11px] font-semibold text-[#8b919c]">{poses.length} cards</p>
        </div>
        <button
          type="button"
          className={cx(
            saboteurTile,
            "inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-[12px] transition-transform active:translate-y-px"
          )}
          aria-label="Randomize pose. Load a random preset from the deck."
          onClick={onRandomize}
        >
          <RandomizePoseIcon />
        </button>
      </div>

      <div className={cx(saboteurSurface, "grid max-h-80 grid-cols-2 gap-2.5 overflow-y-auto p-2.5")}>
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
        "flex w-full cursor-pointer flex-col gap-1.5 rounded-[14px] p-2 text-left transition-transform active:translate-y-px",
        selected
          ? "bg-[#ef5c6b] shadow-[inset_0_1.5px_0_rgba(255,255,255,0.35),0_2px_3px_rgba(0,0,0,0.18),0_6px_12px_rgba(150,25,40,0.45)]"
          : cx(saboteurTile, "transition-transform")
      )}
      onClick={onSelect}
      aria-label={`Select ${pose.name}`}
      aria-pressed={selected}
    >
      <div className="relative overflow-hidden rounded-[10px] bg-[#0c0d12]">
        <PoseThumbnail pose={pose} />
        {selected ? (
          <span className="absolute top-1.5 right-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#252830] text-[11px] font-bold text-white">
            ✓
          </span>
        ) : null}
      </div>
      <span className={cx("truncate text-[11px] leading-tight font-extrabold", selected ? "text-white" : "text-[#ece8e0]")}>{pose.name}</span>
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
    <svg viewBox={`0 0 ${CARD_WIDTH} ${CARD_HEIGHT}`} className="block h-auto w-full" aria-hidden="true">
      <rect x={0} y={0} width={CARD_WIDTH} height={CARD_HEIGHT} className="fill-[#0c0d12]" />
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
        x1={6}
        y1={CARD_HEIGHT - 10}
        x2={CARD_WIDTH - 6}
        y2={CARD_HEIGHT - 10}
        className="stroke-[#ef5c6b] stroke-3 [stroke-linecap:round]"
      />
    </svg>
  );
}
