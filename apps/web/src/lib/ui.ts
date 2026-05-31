export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export const appShell =
  "min-h-dvh bg-[radial-gradient(circle_at_12%_0%,rgba(255,214,92,0.16),transparent_32rem),linear-gradient(135deg,#0c121a_0%,#17202b_48%,#15261f_100%)] font-[Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif] text-[#f6f4ea] [color-scheme:dark] antialiased";

export const topbar =
  "sticky top-0 z-5 flex flex-col items-start justify-between gap-4 border-b border-[#f6f4ea]/12 bg-[#0c121a]/84 px-[clamp(1rem,4vw,3rem)] py-3 backdrop-blur-[18px] min-[861px]:flex-row min-[861px]:items-center";

export const brand = "font-extrabold no-underline";

export const navList = "flex flex-wrap items-center justify-end gap-1";

export const navLink =
  "min-h-9 rounded-md border border-transparent px-3 py-2 text-[#d8e2df] no-underline hover:border-[#75e2be]/55 hover:bg-[#75e2be]/10 hover:text-white [&.active]:border-[#75e2be]/55 [&.active]:bg-[#75e2be]/10 [&.active]:text-white";

export const eyebrow =
  "mt-0 mb-3 text-sm font-extrabold uppercase tracking-normal text-[#75e2be]";

export const heroActions = "flex flex-wrap items-center gap-3";

const actionBase =
  "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md border px-4 py-3 font-extrabold no-underline disabled:cursor-not-allowed disabled:opacity-45";

export const primaryAction = cx(actionBase, "border-transparent bg-[#ffd65c] text-[#101720]");

export const secondaryAction = cx(
  actionBase,
  "border-white/20 bg-white/8 text-[#f6f4ea] hover:bg-white/12"
);

export const panel =
  "rounded-lg border border-[#f6f4ea]/16 bg-[#0c121a]/78 shadow-[0_24px_80px_rgba(0,0,0,0.28)]";

export const pageGrid =
  "relative mx-auto w-[min(1120px,calc(100%-2rem))] py-[clamp(2rem,5vw,4rem)]";

export const pageTitle = "mt-0 mb-4 text-[clamp(2.4rem,6vw,4.5rem)] leading-[0.95]";

export const splitLayout =
  "grid grid-cols-1 items-stretch gap-4 min-[861px]:grid-cols-[minmax(0,1fr)_minmax(260px,340px)]";

export const canvasPanel = cx(panel, "min-h-80 overflow-hidden bg-[#0a0f16]");

export const canvasStage = cx(canvasPanel, "grid place-items-center [&_canvas]:h-auto! [&_canvas]:w-[min(100%,560px)]! [&_canvas]:rounded-md");

export const toolPanel = cx(panel, "flex flex-col items-stretch justify-start gap-3 p-4");

export const largeStatus = "text-xl font-extrabold text-[#ffd65c]";

export const humanPreview = cx(canvasPanel, "h-[min(70vh,560px)] w-full");

export const previewZone = "fill-[#75e2be]/8 stroke-[#75e2be]/38 stroke-2";

export const floorLine = "stroke-[#ffd65c] stroke-[5]";

export const limbLine = "stroke-[#f6f4ea] stroke-[10]";

export const jointDot = "fill-[#ef5c6b] stroke-[#101720] stroke-[3]";

export const saboteurStage = "w-full max-w-full aspect-[800/480] max-h-[min(68vh,640px)]";

export const saboteurViewport = cx("block w-full bg-transparent", saboteurStage);

export function saboteurJointHandleClass(active: boolean) {
  return cx(
    "cursor-grab stroke-none",
    active ? "cursor-grabbing fill-[rgba(15,32,80,0.55)]" : "fill-[rgba(15,32,80,0.3)]"
  );
}

export const saboteurStageBoundsRect =
  "fill-none stroke-[rgba(239,92,107,0.5)] [stroke-width:2.5] [stroke-dasharray:12_9]";

export const saboteurStageFloorLine = "stroke-[#ef5c6b] [stroke-width:5] [stroke-linecap:round]";

export const saboteurTorsoHandleIcon =
  "fill-none stroke-[#ff7a88] [stroke-width:3] [stroke-linecap:round] [stroke-linejoin:round]";

export const metricLabel = "text-sm text-[#aebbb8]";

export const metricValue = "m-0 font-extrabold";

// ── "Poses for Dummies" cream HUD theme (shared with the posing page) ─────────
// Playful cream cards + yellow/cream pills with a layered 3D-ish shadow, the navy
// ink text from the logo, and the same score-band colors used on the athlete HUD.
export const INK = "#2b303b";

export const hudCard =
  "rounded-[18px] bg-[#fdf6e8] shadow-[inset_0_1.5px_0_rgba(255,255,255,0.9),0_2px_3px_rgba(0,0,0,0.12),0_12px_24px_rgba(80,55,0,0.3)]";

export const hudLabel = "block text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#a89a82]";

const pillBase =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[16px] px-4 py-3 font-extrabold no-underline transition-transform active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50";

export const pillSecondary = cx(
  pillBase,
  "bg-[#fdf6e8] text-[#2b303b] shadow-[inset_0_1.5px_0_rgba(255,255,255,0.95),0_2px_3px_rgba(0,0,0,0.14),0_9px_18px_rgba(70,50,0,0.3)] hover:bg-white"
);

export const pillPrimary = cx(
  pillBase,
  "bg-[#ffc83d] text-[#2b303b] shadow-[inset_0_1.5px_0_rgba(255,255,255,0.6),0_2px_3px_rgba(0,0,0,0.16),0_9px_18px_rgba(180,120,0,0.45)] hover:brightness-[1.04]"
);

// Saboteur "villain" red, used where the athlete HUD would use the yellow primary.
export const pillDanger = cx(
  pillBase,
  "bg-[#ef5c6b] text-white shadow-[inset_0_1.5px_0_rgba(255,255,255,0.35),0_2px_3px_rgba(0,0,0,0.18),0_9px_18px_rgba(150,25,40,0.5)] hover:brightness-[1.05]"
);

// ── Saboteur dark HUD — grey cards that still pop off the app shell ───────────
export const saboteurCard =
  "rounded-[18px] bg-[#2e3139] shadow-[inset_0_1.5px_0_rgba(255,255,255,0.08),0_2px_4px_rgba(0,0,0,0.35),0_12px_28px_rgba(0,0,0,0.45)]";

export const saboteurSurface =
  "rounded-[12px] bg-[#252830] shadow-[inset_0_1px_3px_rgba(0,0,0,0.35)]";

export const saboteurLabel =
  "block text-xs font-extrabold tracking-normal text-[#8b919c]";

export const saboteurPillSecondary = cx(
  pillBase,
  "bg-[#3a3f4a] text-[#ece8e0] shadow-[inset_0_1.5px_0_rgba(255,255,255,0.1),0_2px_4px_rgba(0,0,0,0.35),0_8px_18px_rgba(0,0,0,0.4)] hover:bg-[#444954]"
);

export const saboteurTile =
  "bg-[#3a3f4a] text-[#ece8e0] shadow-[inset_0_1.5px_0_rgba(255,255,255,0.08),0_2px_4px_rgba(0,0,0,0.3),0_8px_16px_rgba(0,0,0,0.35)] hover:bg-[#444954]";

/** Full-viewport backdrop for the saboteur page — deep red behind all UI. */
export const saboteurPageBg =
  "bg-[radial-gradient(circle_at_18%_-5%,rgba(255,70,90,0.14),transparent_38rem),linear-gradient(155deg,#1a0407_0%,#3b0c12_46%,#220508_100%)]";
