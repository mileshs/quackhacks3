import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import type p5 from "p5";
import {
  GameRole,
  HOLE_PADDING,
  applyRoundSnapshot,
  buildBlobFigure,
  DEFAULT_POWERUP_DURATION_MS,
  registerSaboteurMove,
  SABOTEUR_POWERUP_DEFINITIONS,
  starterPoses,
  universalHumanSize,
  type FaceMode,
  type FigurePrimitive,
  type JointName,
  type SaboteurPowerupProgress,
  type UniversalJoint,
  type UniversalPose
} from "@quackhacks/shared";
import { drawDummyScene3D, type ScreenPoint } from "../lib/dummy3d";
import { SaboteurSplash } from "../components/SaboteurSplash";
import { SaboteurDeckPanel } from "../components/SaboteurDeckPanel";
import { SaboteurPowerupPanel } from "../components/SaboteurPowerupPanel";
import { SaboteurToolbar } from "../components/SaboteurToolbar";
import { SaboteurTutorialOverlay } from "../components/SaboteurTutorialOverlay";
import { RoleGameShell } from "../components/RoleGameShell";
import { loadSavedPoses, persistSavedPoses } from "../lib/savedPoses";
import { useChrome } from "../lib/chrome";
import { SKELETON_ADJUSTMENT_SOUNDS, useSound } from "../providers/SoundProvider";
import {
  cx,
  pillDanger,
  saboteurCard,
  saboteurJointHandleClass,
  saboteurPageBg,
  saboteurPillSecondary,
  saboteurStage,
  saboteurStageBoundsRect,
  saboteurStageFloorLine,
  saboteurTorsoHandleIcon,
  saboteurViewport
} from "../lib/ui";
import { useActiveGame } from "../lib/useActiveGame";

const SPLASH_SEEN_STORAGE_KEY = "quackhacks:saboteur:splashSeen";
const JOINT_HANDLE_RADIUS = 10;

const GROUND_Y = 0.94;
const MIN_DRAG_RADIUS = 0.025;
const MAX_LEG_SPREAD_DEGREES = 120;
// Wide play-area bounds (normalized) for the JOINTS. X is generous so the figure can
// roam across the landscape stage. The ankles (the lowest joints) clamp to GROUND_Y;
// the blob's feet are drawn a little below the ankle, so the foot SOLE — not the joint —
// is what rests on the floor line and it can never poke through it.
const POSE_MIN_X = -0.7;
const POSE_MAX_X = 1.7;
const POSE_MIN_Y = -0.08;
const POSE_MAX_Y = GROUND_Y;

const W = universalHumanSize.width;
const H = universalHumanSize.height;

// How far the blob figure overflows its joints (universal-box pixels): the head ellipse
// rises above the head joint, the feet drop below the ankles, and wrist/limb caps stick
// out sideways. We reserve room for these when fitting the figure into the stage so the
// head never clips at the top and the feet land exactly on the floor line.
const FIGURE_HEAD_RISE = 66;
const FIGURE_FOOT_DROP = 16;
const FIGURE_SIDE_MARGIN = 18;

// Landscape stage in SVG user units. The element keeps this aspect ratio so it
// fills the wide stage column without letterboxing.
const STAGE_WIDTH = 800;
const STAGE_HEIGHT = 480;
const STAGE_INSET = 16;

// The floor line sits at the bottom of the feet (ankle ground level + foot drop) so a
// grounded foot rests on it; because ankles clamp at GROUND_Y, the sole can't cross it.
const FLOOR_PX = GROUND_Y * H + FIGURE_FOOT_DROP;

// Fit the FULL visual extent of the figure (joints + the overflow around them) into the
// stage with a uniform scale, then center it — so the head and feet always stay in frame.
const contentMinX = POSE_MIN_X * W - FIGURE_SIDE_MARGIN;
const contentMaxX = POSE_MAX_X * W + FIGURE_SIDE_MARGIN;
const contentMinY = POSE_MIN_Y * H - FIGURE_HEAD_RISE;
const contentMaxY = FLOOR_PX;
const contentWidthPx = contentMaxX - contentMinX;
const contentHeightPx = contentMaxY - contentMinY;
const dummyScale = Math.min(
  (STAGE_WIDTH - STAGE_INSET * 2) / contentWidthPx,
  (STAGE_HEIGHT - STAGE_INSET * 2) / contentHeightPx
);
const dummyTranslateX = (STAGE_WIDTH - contentWidthPx * dummyScale) / 2 - contentMinX * dummyScale;
const dummyTranslateY = (STAGE_HEIGHT - contentHeightPx * dummyScale) / 2 - contentMinY * dummyScale;
const dummyTransform = `translate(${dummyTranslateX} ${dummyTranslateY}) scale(${dummyScale})`;

const stageBounds = {
  x: POSE_MIN_X * W,
  y: POSE_MIN_Y * H,
  width: (POSE_MAX_X - POSE_MIN_X) * W,
  // Extend the dashed box down to the floor line so the feet rest on its bottom edge.
  height: FLOOR_PX - POSE_MIN_Y * H
};
const stageFloorY = FLOOR_PX;
const jointParents = {
  head: "neck",
  neck: "hips",
  leftShoulder: "neck",
  rightShoulder: "neck",
  leftElbow: "leftShoulder",
  rightElbow: "rightShoulder",
  leftWrist: "leftElbow",
  rightWrist: "rightElbow",
  hips: null,
  leftKnee: "hips",
  rightKnee: "hips",
  leftAnkle: "leftKnee",
  rightAnkle: "rightKnee"
} satisfies Record<JointName, JointName | null>;

const jointChildren = {
  head: [],
  neck: ["head", "leftShoulder", "rightShoulder"],
  leftShoulder: ["leftElbow"],
  rightShoulder: ["rightElbow"],
  leftElbow: ["leftWrist"],
  rightElbow: ["rightWrist"],
  leftWrist: [],
  rightWrist: [],
  hips: ["neck", "leftKnee", "rightKnee"],
  leftKnee: ["leftAnkle"],
  rightKnee: ["rightAnkle"],
  leftAnkle: [],
  rightAnkle: []
} satisfies Record<JointName, JointName[]>;

type JointRotationLimit = {
  centerDegrees: number;
  radiusDegrees: number;
};

const jointRotationLimits: Partial<Record<JointName, JointRotationLimit>> = {
  // Keep the neck/head close to upright, with only a 45 degree lean left/right.
  head: { centerDegrees: -90, radiusDegrees: 20 },
  neck: { centerDegrees: -90, radiusDegrees: 40 },
  // Shoulder anchors should stay near the upper torso instead of orbiting around
  // the neck into impossible positions.
  leftShoulder: { centerDegrees: 170, radiusDegrees: 10 },
  rightShoulder: { centerDegrees: 10, radiusDegrees: 10 },
  // Upper arms rotate from the shoulders. Keep these broad enough for big poses,
  // but prevent full impossible rotations through the torso.
  leftElbow: { centerDegrees: 90, radiusDegrees: 155 },
  rightElbow: { centerDegrees: 90, radiusDegrees: 155 },
  leftWrist: { centerDegrees: 90, radiusDegrees: 165 },
  rightWrist: { centerDegrees: 90, radiusDegrees: 165 },
  // Legs should stay in a plausible lower-body arc. The support-leg constraint
  // still handles the exact planted foot position.
  leftKnee: { centerDegrees: 90, radiusDegrees: 80 },
  rightKnee: { centerDegrees: 90, radiusDegrees: 80 },
  leftAnkle: { centerDegrees: 90, radiusDegrees: 95 },
  rightAnkle: { centerDegrees: 90, radiusDegrees: 95 }
};

function HamburgerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

/**
 * A transient error toast pinned to the top-left of the stage. It fades in on mount,
 * holds, then fades out and clears itself a few seconds later — so a failed save no
 * longer reflows the toolbar buttons. Re-mount it with a changing `key` to replay.
 */
function SaveErrorToast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);
  // Keep the latest onDismiss without re-running the lifecycle effect, so the parent
  // re-rendering (e.g. during a wiggle) never resets the fade timers.
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    const fadeInId = window.requestAnimationFrame(() => setVisible(true));
    const fadeOutId = window.setTimeout(() => setVisible(false), 2600);
    const dismissId = window.setTimeout(() => onDismissRef.current(), 3000);
    return () => {
      window.cancelAnimationFrame(fadeInId);
      window.clearTimeout(fadeOutId);
      window.clearTimeout(dismissId);
    };
  }, []);

  return (
    <div
      role="alert"
      data-saboteur-save-error
      className={cx(
        "pointer-events-none absolute left-1/2 bottom-[26%] z-20 max-w-[min(92%,320px)] -translate-x-1/2 rounded-[10px] bg-[#ef5c6b] px-3 py-2 text-center text-sm font-bold text-white shadow-[0_8px_22px_rgba(150,25,40,0.5)] transition-opacity duration-300",
        visible ? "opacity-100" : "opacity-0"
      )}
    >
      {message}
    </div>
  );
}

export function SaboteurPage() {
  const { setNavHidden } = useChrome();
  // Dev mode reveals the developer-only chrome: the global navbar, the "Your Progress"
  // tracker, and the reward simulator buttons. Off by default for a clean player view.
  const [devMode, setDevMode] = useState(false);
  const [poseIndex, setPoseIndex] = useState(1);
  const [draftPose, setDraftPose] = useState<UniversalPose | null>(null);
  const [savedPoses, setSavedPoses] = useState<UniversalPose[]>(loadSavedPoses);
  const [socketStatus, setSocketStatus] = useState("WebSocket connecting");
  const [saveError, setSaveError] = useState<string | null>(null);
  // Bumped on each failed save so the error toast re-mounts and replays its fade even
  // when the message text is identical to the previous attempt.
  const [saveErrorNonce, setSaveErrorNonce] = useState(0);
  const [showHole, setShowHole] = useState(false);
  const gameControls = useActiveGame();
  const { connectionStatus, lastRoundSnapshot, sendPose: sendGamePose, sendPowerup } = gameControls;
  const [showSplash, setShowSplash] = useState(() => {
    if (typeof window === "undefined") {
      return true;
    }
    return window.localStorage.getItem(SPLASH_SEEN_STORAGE_KEY) !== "true";
  });
  const [tutorialRun, setTutorialRun] = useState(0);
  const [powerupProgress, setPowerupProgress] = useState<SaboteurPowerupProgress>({
    inventory: [],
    perfectStreak: 0,
    movesSinceGrant: 0
  });

  function dismissSplash() {
    setShowSplash(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SPLASH_SEEN_STORAGE_KEY, "true");
    }
  }

  // The navbar is hidden on this page unless dev mode is on; restore it on unmount.
  useEffect(() => {
    setNavHidden(!devMode);
    return () => setNavHidden(false);
  }, [devMode, setNavHidden]);

  useEffect(() => {
    persistSavedPoses(savedPoses);
  }, [savedPoses]);

  const poseList = useMemo(() => [...starterPoses, ...savedPoses], [savedPoses]);
  const pose = poseList[poseIndex] ?? poseList[0];
  const activePose = draftPose ?? pose;
  const selectedSavedPoseIndex = poseIndex - starterPoses.length;
  const canRenameSavedPose =
    !draftPose && selectedSavedPoseIndex >= 0 && selectedSavedPoseIndex < savedPoses.length;
  const [poseName, setPoseName] = useState(activePose.name);

  const displayPose = useMemo(
    () => ({
      ...activePose,
      name: poseName.trim() || activePose.name
    }),
    [activePose, poseName]
  );

  useEffect(() => {
    setPoseName(activePose.name);
  }, [activePose.id, activePose.name, draftPose?.id, poseIndex]);

  function updatePoseName(nextName: string) {
    setPoseName(nextName);

    if (draftPose) {
      setDraftPose({ ...draftPose, name: nextName });
      return;
    }

    if (canRenameSavedPose) {
      setSavedPoses((currentPoses) =>
        currentPoses.map((entry, index) =>
          index === selectedSavedPoseIndex ? { ...entry, name: nextName } : entry
        )
      );
    }
  }

  useEffect(() => {
    setSocketStatus(`WebSocket ${connectionStatus}`);
  }, [connectionStatus]);

  useEffect(() => {
    if (!lastRoundSnapshot) {
      return;
    }

    setPowerupProgress((current) => applyRoundSnapshot(current, lastRoundSnapshot.band));
    setSocketStatus(`Round: ${lastRoundSnapshot.band} (${lastRoundSnapshot.matchPercent}%)`);
  }, [lastRoundSnapshot]);

  function activatePowerup(slotId: string) {
    const slot = powerupProgress.inventory.find((entry) => entry.id === slotId);
    if (!slot) {
      return;
    }

    sendPowerup({
      kind: slot.kind,
      durationMs: DEFAULT_POWERUP_DURATION_MS,
      sentAt: new Date().toISOString()
    });

    setPowerupProgress((current) => ({
      ...current,
      inventory: current.inventory.filter((entry) => entry.id !== slotId)
    }));
    setSocketStatus(`Deployed ${SABOTEUR_POWERUP_DEFINITIONS[slot.kind].name}`);
  }

  function simulatePerfectRound() {
    setPowerupProgress((current) => applyRoundSnapshot(current, "PERFECT"));
  }

  function simulateMove() {
    setPowerupProgress((current) => registerSaboteurMove(current));
  }

  function randomizePose() {
    setPowerupProgress((current) => registerSaboteurMove(current));
    setSaveError(null);
    setShowHole(false);

    if (poseList.length <= 1) {
      if (draftPose) {
        setDraftPose(clonePose(poseList[0]!));
      } else {
        setPoseIndex(0);
      }
      return;
    }

    let nextIndex = poseIndex;
    while (nextIndex === poseIndex) {
      nextIndex = Math.floor(Math.random() * poseList.length);
    }

    const nextPose = poseList[nextIndex]!;

    if (draftPose) {
      setDraftPose(clonePose(nextPose));
      setPoseName(nextPose.name);
      return;
    }

    setDraftPose(null);
    setPoseIndex(nextIndex);
  }

  function makePose() {
    setSaveError(null);
    setShowHole(false);
    setDraftPose(createStandingPose());
  }

  function editSelectedPose() {
    setSaveError(null);
    setShowHole(false);
    setDraftPose(clonePose(pose));
  }

  function cancelDraft() {
    setSaveError(null);
    setShowHole(false);
    setDraftPose(null);
  }

  function addPose() {
    savePose();
  }

  function sendPose() {
    broadcastPose(displayPose);
  }

  function savePose() {
    if (!draftPose) {
      return;
    }

    const normalizedDraftPose = applyPoseConstraints(draftPose, "hips");

    if (!hasGroundedFoot(normalizedDraftPose)) {
      setSaveError("One foot must be touching the ground");
      setSaveErrorNonce((nonce) => nonce + 1);
      return;
    }

    const savedPose = {
      ...normalizedDraftPose,
      id: `custom-pose-${Date.now()}`,
      name: normalizedDraftPose.name.trim() || poseName.trim() || `Custom Pose ${savedPoses.length + 1}`,
      joints: normalizedDraftPose.joints.map((joint) => ({ ...joint }))
    };

    setSaveError(null);
    setSavedPoses((currentPoses) => [...currentPoses, savedPose]);
    setPoseIndex(starterPoses.length + savedPoses.length);
    setDraftPose(null);
    setSocketStatus(`Saved ${savedPose.name}`);
  }

  function selectDeckPose(index: number) {
    setSaveError(null);
    setShowHole(false);
    setDraftPose(null);
    setPoseIndex(index);
  }

  function broadcastPose(selectedPose: UniversalPose) {
    sendGamePose(selectedPose);
    setSocketStatus(`Sent ${selectedPose.name}`);
  }

  const socketReady = /ready|connected/i.test(socketStatus);

  return (
    <RoleGameShell role={GameRole.Saboteur} controls={gameControls}>
      <div className={cx("pointer-events-none fixed inset-0 z-0", saboteurPageBg)} aria-hidden="true" />
      <section className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[1680px] flex-col gap-3 px-3 py-3 sm:px-4">
      {showSplash ? <SaboteurSplash onDismiss={dismissSplash} /> : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,300px)] lg:items-stretch">
        <div className="flex min-h-0 flex-col gap-3">
          {/* Canvas card: stage + tool buttons along the bottom of the dark viewport. */}
          <div className={cx(saboteurCard, "relative flex min-h-[min(70vh,680px)] flex-1 flex-col overflow-hidden p-3")}>
            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[12px] bg-[#0c0d12] shadow-[inset_0_2px_10px_rgba(0,0,0,0.45)]">
              {saveError ? (
                <SaveErrorToast key={saveErrorNonce} message={saveError} onDismiss={() => setSaveError(null)} />
              ) : null}
              <div className="flex min-h-0 flex-1 items-center justify-center px-2 py-2">
                {showHole ? (
                  <SaboteurHolePreview pose={displayPose} />
                ) : draftPose ? (
                  <SaboteurPoseEditor pose={draftPose} onChange={setDraftPose} />
                ) : (
                  <SaboteurPosePreview pose={displayPose} />
                )}
              </div>

              <SaboteurToolbar
                draftActive={Boolean(draftPose)}
                showHole={showHole}
                onMakePose={makePose}
                onEditPose={editSelectedPose}
                onCancelDraft={cancelDraft}
                onToggleHole={() => setShowHole((current) => !current)}
                onSavePose={addPose}
                onSendPose={sendPose}
                onStartTutorial={() => setTutorialRun((run) => run + 1)}
              />
            </div>
          </div>

          {devMode ? (
            <footer className={cx(saboteurCard, "px-4 py-2.5")}>
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-[#8b919c]">
                <span className="inline-flex items-center gap-1.5 text-[#ece8e0]">
                  <span className={cx("inline-block h-2.5 w-2.5 rounded-full", socketReady ? "bg-[#2fb86b]" : "bg-[#5c6068]")} />
                  {socketReady ? "Connected & ready" : "Connecting…"}
                </span>
                <span className="hidden sm:inline">{socketStatus}</span>
              </div>
            </footer>
          ) : null}
        </div>

        <aside className="flex min-h-0 flex-1 flex-col gap-3">
          <button
            type="button"
            className={cx(
              devMode ? pillDanger : saboteurPillSecondary,
              "w-full px-4 py-2.5 text-[13px]"
            )}
            aria-pressed={devMode}
            onClick={() => setDevMode((on) => !on)}
          >
            <span className="inline-flex w-full items-center justify-center gap-2">
              <HamburgerIcon />
              Controls
            </span>
          </button>

          <SaboteurDeckPanel
            poses={poseList}
            selectedIndex={poseIndex}
            onSelect={selectDeckPose}
            onRandomize={randomizePose}
          />
          <SaboteurPowerupPanel
            inventory={powerupProgress.inventory}
            perfectStreak={powerupProgress.perfectStreak}
            movesSinceGrant={powerupProgress.movesSinceGrant}
            showDevSections={devMode}
            onActivate={activatePowerup}
            onSimulatePerfect={simulatePerfectRound}
            onSimulateMove={simulateMove}
          />
        </aside>
      </div>
    </section>
      <SaboteurTutorialOverlay runKey={tutorialRun} />
    </RoleGameShell>
  );
}

type SaboteurPoseEditorProps = {
  pose: UniversalPose;
  onChange: (pose: UniversalPose) => void;
};

// Render shared figure primitives (universal-box pixel coords) as SVG. Both the blob
// dummy and the hole cutout are built from `buildBlobFigure`, so the saboteur and the
// athlete draw the exact same shape.
function FigurePrimitives({ prims }: { prims: FigurePrimitive[] }) {
  return (
    <>
      {prims.map((prim, index) => {
        switch (prim.kind) {
          case "capsule":
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
          case "circle":
            return <circle key={index} cx={prim.c.x} cy={prim.c.y} r={prim.r} fill={prim.fill} />;
          case "ellipse":
            return <ellipse key={index} cx={prim.c.x} cy={prim.c.y} rx={prim.rx} ry={prim.ry} fill={prim.fill} />;
          case "polyline":
            return (
              <polyline
                key={index}
                points={prim.points.map((point) => `${point.x},${point.y}`).join(" ")}
                fill="none"
                stroke={prim.stroke}
                strokeWidth={prim.width}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          case "quad":
            return (
              <path
                key={index}
                d={`M ${prim.from.x} ${prim.from.y} Q ${prim.control.x} ${prim.control.y} ${prim.to.x} ${prim.to.y}`}
                fill="none"
                stroke={prim.stroke}
                strokeWidth={prim.width}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          default:
            return null;
        }
      })}
    </>
  );
}

// The play-area bounding box plus the extended floor line, drawn inside the
// dummy transform so it lines up exactly with the figure and movement bounds.
function StageBounds() {
  return (
    <g>
      <rect
        x={stageBounds.x}
        y={stageBounds.y}
        width={stageBounds.width}
        height={stageBounds.height}
        rx={16}
        className={saboteurStageBoundsRect}
      />
      <line
        x1={stageBounds.x}
        y1={stageFloorY}
        x2={stageBounds.x + stageBounds.width}
        y2={stageFloorY}
        className={saboteurStageFloorLine}
      />
    </g>
  );
}

/**
 * The 3D blob dummy (p5.js WEBGL), rendered with the exact same shared renderer the
 * athlete/posing page uses so the two screens look identical. The universal box is mapped
 * into the canvas using the same `dummyTransform` (scale + translate) the SVG layer uses
 * — with `preserveAspectRatio="xMidYMid meet"` centering — so the 3D dummy lines up pixel
 * for pixel with the SVG joint handles / bounds overlaid on top of it.
 */
function randomBlinkDelayMs() {
  return 2200 + Math.random() * 4800;
}

const BLINK_CLOSE_MS = 130;

function Dummy3DStage({
  pose,
  faceMode = "happy",
  className,
  blink = true
}: {
  pose: UniversalPose;
  faceMode?: FaceMode;
  className?: string;
  blink?: boolean;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  // The detect/animation loop reads the latest pose + face through refs so we never have
  // to tear down and rebuild the p5 sketch on every pose change (e.g. during a wiggle).
  const poseRef = useRef(pose);
  poseRef.current = pose;
  const faceModeRef = useRef<FaceMode>(faceMode);
  faceModeRef.current = faceMode;
  const eyesClosedRef = useRef(false);

  useEffect(() => {
    if (!blink) {
      eyesClosedRef.current = false;
      return;
    }

    let blinkTimer = 0;
    let openTimer = 0;

    const scheduleBlink = () => {
      blinkTimer = window.setTimeout(() => {
        if (faceModeRef.current !== "squeeze") {
          eyesClosedRef.current = true;
          openTimer = window.setTimeout(() => {
            eyesClosedRef.current = false;
            scheduleBlink();
          }, BLINK_CLOSE_MS);
          return;
        }
        scheduleBlink();
      }, randomBlinkDelayMs());
    };

    scheduleBlink();

    return () => {
      window.clearTimeout(blinkTimer);
      window.clearTimeout(openTimer);
      eyesClosedRef.current = false;
    };
  }, [blink]);

  useEffect(() => {
    let sketch: p5 | undefined;
    let cancelled = false;

    void import("p5").then((module) => {
      if (cancelled || !mountRef.current) {
        return;
      }
      const P5 = module.default;
      sketch = new P5((p: p5) => {
        p.setup = () => {
          const el = mountRef.current;
          p.createCanvas(el?.clientWidth || STAGE_WIDTH, el?.clientHeight || STAGE_HEIGHT, p.WEBGL);
          p.noStroke();
        };
        p.draw = () => {
          // Keep the canvas matched to its container so the dummy stays aligned with the
          // SVG overlay as the layout resizes.
          const el = mountRef.current;
          if (el) {
            const w = el.clientWidth;
            const h = el.clientHeight;
            if (w && h && (Math.abs(w - p.width) > 1 || Math.abs(h - p.height) > 1)) {
              p.resizeCanvas(w, h);
            }
          }
          p.clear();

          const currentPose = poseRef.current;
          // Replicate SVG `preserveAspectRatio="xMidYMid meet"`: uniform scale to fit the
          // viewBox inside the canvas, then center the leftover space.
          const factor = Math.min(p.width / STAGE_WIDTH, p.height / STAGE_HEIGHT);
          const offsetX = (p.width - STAGE_WIDTH * factor) / 2;
          const offsetY = (p.height - STAGE_HEIGHT * factor) / 2;
          const s = dummyScale * factor;

          const map = new Map(currentPose.joints.map((joint) => [joint.name, joint] as const));
          const at = (name: JointName): ScreenPoint | null => {
            const joint = map.get(name);
            return joint
              ? {
                  x: offsetX + (dummyTranslateX + joint.x * universalHumanSize.width * dummyScale) * factor,
                  y: offsetY + (dummyTranslateY + joint.y * universalHumanSize.height * dummyScale) * factor
                }
              : null;
          };

          drawDummyScene3D(p, {
            at,
            s,
            width: p.width,
            height: p.height,
            faceMode: faceModeRef.current,
            eyesClosed: blink && eyesClosedRef.current && faceModeRef.current === "happy"
          });
        };
      }, mountRef.current);
    });

    return () => {
      cancelled = true;
      sketch?.remove();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      aria-hidden="true"
      className={cx(className, "[&>canvas]:block [&>canvas]:h-full [&>canvas]:w-full")}
    />
  );
}

function SaboteurPosePreview({ pose }: { pose: UniversalPose }) {
  return (
    <div className={cx("relative", saboteurStage)}>
      <Dummy3DStage pose={pose} className="absolute inset-0 h-full w-full" />
      <svg
        className="absolute inset-0 block h-full w-full bg-transparent"
        viewBox={`0 0 ${STAGE_WIDTH} ${STAGE_HEIGHT}`}
        role="img"
        aria-label={pose.name}
      >
        <g transform={dummyTransform}>
          <StageBounds />
        </g>
      </svg>
    </div>
  );
}

// The saboteur's red wall the pose carves a hole through (red counterpart of the
// athlete's yellow wall).
const WALL_TOP = "#ff6b78";
const WALL_BOTTOM = "#d8313f";

// The figure's solid outline, used as the cutout for the hole. `pad` inflates
// every limb so the hole leaves generous room around the pose. Shares geometry with
// the blob dummy (no face), so the hole matches the figure exactly on both screens.
function FigureSilhouette({
  jointMap,
  color,
  pad
}: {
  jointMap: Map<JointName, UniversalJoint>;
  color: string;
  pad: number;
}) {
  const prims = useMemo(
    () => buildBlobFigure(Array.from(jointMap.values()), { color, pad }),
    [jointMap, color, pad]
  );

  return (
    <g>
      <FigurePrimitives prims={prims} />
    </g>
  );
}

// Shows the wall the pose carves out: a solid panel with the figure-shaped hole
// punched through it. The stick figure itself is hidden here.
function SaboteurHolePreview({ pose }: { pose: UniversalPose }) {
  const jointMap = useMemo(() => new Map(pose.joints.map((joint) => [joint.name, joint])), [pose.joints]);
  const maskId = `hole-mask-${pose.id}`;

  return (
    <svg
      className={saboteurViewport}
      viewBox={`0 0 ${STAGE_WIDTH} ${STAGE_HEIGHT}`}
      role="img"
      aria-label={`Hole preview for ${pose.name}`}
    >
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse">
          <rect x={0} y={0} width={STAGE_WIDTH} height={STAGE_HEIGHT} fill="white" />
          <g transform={dummyTransform}>
            <FigureSilhouette jointMap={jointMap} color="black" pad={HOLE_PADDING} />
          </g>
        </mask>
        <linearGradient id={`${maskId}-wall`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={WALL_TOP} />
          <stop offset="1" stopColor={WALL_BOTTOM} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={STAGE_WIDTH} height={STAGE_HEIGHT} fill={`url(#${maskId}-wall)`} mask={`url(#${maskId})`} />
    </svg>
  );
}

function SaboteurPoseEditor({ pose, onChange }: SaboteurPoseEditorProps) {
  const { playExclusiveRandomSoundEffect, stopExclusiveSoundEffect } = useSound();
  const svgRef = useRef<SVGSVGElement>(null);
  const latestPoseRef = useRef(pose);
  const wriggleBaseRef = useRef<UniversalPose | null>(null);
  const bodyDragRef = useRef<{ lastX: number; lastY: number } | null>(null);
  const adjustmentDragActiveRef = useRef(false);
  const [activeJoint, setActiveJoint] = useState<JointName | null>(null);
  const [isWriggling, setIsWriggling] = useState(false);
  const jointMap = useMemo(() => new Map(pose.joints.map((joint) => [joint.name, joint])), [pose.joints]);
  const torsoCenter = getTorsoCenter(jointMap);
  const footGrounded = useMemo(
    () => hasGroundedFoot(applyPoseConstraints(pose, activeJoint ?? "hips")),
    [pose, activeJoint]
  );

  useEffect(() => {
    latestPoseRef.current = pose;
  }, [pose]);

  useEffect(() => {
    return () => {
      adjustmentDragActiveRef.current = false;
      stopExclusiveSoundEffect();
    };
  }, [stopExclusiveSoundEffect]);

  function notifyJointAdjustment() {
    playExclusiveRandomSoundEffect(SKELETON_ADJUSTMENT_SOUNDS, () => adjustmentDragActiveRef.current);
  }

  function stopAdjustmentSound() {
    adjustmentDragActiveRef.current = false;
    stopExclusiveSoundEffect();
  }

  useEffect(() => {
    if (!isWriggling) {
      return;
    }

    let animationFrameId = 0;
    const legSide = Math.random() < 0.5 ? "left" : "right";
    const startedAt = performance.now();

    function animate(now: number) {
      // Wave around a movable base pose so the figure keeps wriggling even while
      // it is being dragged around the stage.
      const basePose = wriggleBaseRef.current ?? latestPoseRef.current;
      const elapsedSeconds = (now - startedAt) / 1000;
      const nextPose = applyPoseConstraints(applyWavePose(basePose, elapsedSeconds, legSide), "hips");

      latestPoseRef.current = nextPose;
      onChange(nextPose);

      animationFrameId = window.requestAnimationFrame(animate);
    }

    animationFrameId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [isWriggling, onChange]);

  function moveActiveJoint(event: PointerEvent<SVGSVGElement>) {
    const point = getPosePoint(event, svgRef.current);
    if (!point) {
      return;
    }

    // Dragging the stomach handle moves the whole figure (x and y) while it
    // keeps wriggling: we translate the wriggle's base pose so the wave loop
    // renders the moved-and-flailing figure.
    const bodyDrag = bodyDragRef.current;
    if (bodyDrag) {
      const dx = point.x - bodyDrag.lastX;
      const dy = point.y - bodyDrag.lastY;
      bodyDrag.lastX = point.x;
      bodyDrag.lastY = point.y;

      const base = wriggleBaseRef.current ?? latestPoseRef.current;
      wriggleBaseRef.current = translatePoseBy(base, dx, dy);
      notifyJointAdjustment();
      return;
    }

    if (!activeJoint) {
      return;
    }

    const nextPose = rotateJointTowardPoint(latestPoseRef.current, activeJoint, point.x, point.y);
    latestPoseRef.current = nextPose;
    onChange(nextPose);
    notifyJointAdjustment();
  }

  function stopPointerAction() {
    stopAdjustmentSound();
    setActiveJoint(null);
    setIsWriggling(false);
    bodyDragRef.current = null;
    wriggleBaseRef.current = null;
  }

  return (
    <div className={cx("relative", saboteurStage)}>
      {/* The 3D blob dummy (same renderer as the posing page) sits behind a transparent
          SVG layer that still owns all the drag interactions: joint handles, the torso
          move handle, the bounds, and the wiggle all live in the SVG on top. */}
      <Dummy3DStage
        pose={pose}
        faceMode={isWriggling ? "squeeze" : "happy"}
        className="absolute inset-0 h-full w-full"
      />
      <svg
        ref={svgRef}
        className={cx("absolute inset-0 block h-full w-full bg-transparent", activeJoint ? "cursor-grabbing" : "cursor-default", "touch-none")}
        viewBox={`0 0 ${STAGE_WIDTH} ${STAGE_HEIGHT}`}
        role="img"
        aria-label="Editable saboteur pose"
        data-foot-grounded={footGrounded ? "true" : "false"}
        onPointerMove={moveActiveJoint}
        onPointerUp={stopPointerAction}
        onPointerCancel={stopPointerAction}
      >
        <g transform={dummyTransform}>
          <StageBounds />
          <TorsoMoveHandle
          cx={torsoCenter.x * universalHumanSize.width}
          cy={torsoCenter.y * universalHumanSize.height}
          isWriggling={isWriggling}
          onPointerDown={(event) => {
            event.stopPropagation();
            event.currentTarget.setPointerCapture(event.pointerId);
            adjustmentDragActiveRef.current = true;
            setActiveJoint(null);
            const point = getPosePoint(event, svgRef.current);
            wriggleBaseRef.current = latestPoseRef.current;
            bodyDragRef.current = point ? { lastX: point.x, lastY: point.y } : null;
            setIsWriggling(true);
          }}
        />
        {pose.joints.map((joint) => (
          <circle
            key={joint.name}
            data-tutorial-joint={joint.name}
            cx={joint.x * universalHumanSize.width}
            cy={joint.y * universalHumanSize.height}
            r={JOINT_HANDLE_RADIUS}
            onPointerDown={(event) => {
              event.stopPropagation();
              event.currentTarget.setPointerCapture(event.pointerId);
              adjustmentDragActiveRef.current = true;
              setIsWriggling(false);
              setActiveJoint(joint.name);
            }}
            className={saboteurJointHandleClass(activeJoint === joint.name)}
          />
        ))}
        {(() => {
          const hips = jointMap.get("hips");
          if (!hips) {
            return null;
          }
          const offsetX = 0.06 * universalHumanSize.width;
          const hipCenterY = hips.y * universalHumanSize.height;
          const hipCenterX = hips.x * universalHumanSize.width;
          const hipMarkerClass = cx(saboteurJointHandleClass(false), "pointer-events-none");
          return (
            <>
              <circle cx={hipCenterX - offsetX} cy={hipCenterY} r={JOINT_HANDLE_RADIUS} className={hipMarkerClass} />
              <circle cx={hipCenterX + offsetX} cy={hipCenterY} r={JOINT_HANDLE_RADIUS} className={hipMarkerClass} />
            </>
          );
        })()}
        </g>
      </svg>
    </div>
  );
}

function TorsoMoveHandle({
  cx,
  cy,
  isWriggling,
  onPointerDown
}: {
  cx: number;
  cy: number;
  isWriggling: boolean;
  onPointerDown: (event: PointerEvent<SVGGElement>) => void;
}) {
  return (
    <g
      transform={`translate(${cx}, ${cy})`}
      onPointerDown={onPointerDown}
      className={isWriggling ? "cursor-grabbing" : "cursor-grab"}
      aria-label="Move entire pose"
      data-tutorial-move-handle
    >
      <circle r={16} className="fill-transparent" />
      <g className={saboteurTorsoHandleIcon}>
        <path d="M 0 -14 V 14" />
        <path d="M 0 -14 L -6 -6 M 0 -14 L 6 -6" />
        <path d="M 0 14 L -6 6 M 0 14 L 6 6" />
        <path d="M -14 0 H 14" />
        <path d="M -14 0 L -6 -6 M -14 0 L -6 6" />
        <path d="M 14 0 L 6 -6 M 14 0 L 6 6" />
      </g>
    </g>
  );
}

function clonePose(pose: UniversalPose): UniversalPose {
  return {
    ...pose,
    joints: pose.joints.map((joint) => ({ ...joint }))
  };
}

function createStandingPose(): UniversalPose {
  return {
    id: "custom-tpose",
    name: "Custom T-Pose",
    difficulty: "standard",
    joints: [
      { name: "head", x: 0.5, y: 0.13, importance: 0.8 },
      { name: "neck", x: 0.5, y: 0.24, importance: 1 },
      { name: "leftShoulder", x: 0.35, y: 0.28, importance: 1 },
      { name: "rightShoulder", x: 0.65, y: 0.28, importance: 1 },
      { name: "leftElbow", x: 0.22, y: 0.28, importance: 0.8 },
      { name: "rightElbow", x: 0.78, y: 0.28, importance: 0.8 },
      { name: "leftWrist", x: 0.1, y: 0.28, importance: 0.6 },
      { name: "rightWrist", x: 0.9, y: 0.28, importance: 0.6 },
      { name: "hips", x: 0.5, y: 0.58, importance: 1 },
      { name: "leftKnee", x: 0.43, y: 0.76, importance: 0.9 },
      { name: "rightKnee", x: 0.57, y: 0.76, importance: 0.9 },
      { name: "leftAnkle", x: 0.4, y: GROUND_Y, importance: 1 },
      { name: "rightAnkle", x: 0.6, y: GROUND_Y, importance: 1 }
    ]
  };
}

function rotateJointTowardPoint(pose: UniversalPose, jointName: JointName, x: number, y: number) {
  if (jointName === "hips") {
    return crouchByHips(pose, y);
  }

  const parentName = jointParents[jointName];

  if (!parentName) {
    return pose;
  }

  const joints = cloneJoints(pose.joints);
  const parent = findJoint(joints, parentName);
  const joint = findJoint(joints, jointName);

  if (!parent || !joint) {
    return pose;
  }

  if (Math.hypot(x - parent.x, y - parent.y) < MIN_DRAG_RADIUS) {
    return pose;
  }

  const currentAngle = Math.atan2(joint.y - parent.y, joint.x - parent.x);
  const nextAngle = clampJointAngle(jointName, Math.atan2(y - parent.y, x - parent.x));
  rotateChain(joints, jointName, parent, nextAngle - currentAngle);

  return applyPoseConstraints({ ...pose, joints }, jointName);
}

// Upper-body joints that travel with the hips during the vertical crouch.
const UPPER_BODY_JOINTS: JointName[] = [
  "hips",
  "neck",
  "head",
  "leftShoulder",
  "rightShoulder",
  "leftElbow",
  "rightElbow",
  "leftWrist",
  "rightWrist"
];

// Translate the whole figure (every joint) by a delta, keeping limb shapes
// intact. Used by the stomach handle to move the dummy anywhere on the stage.
function translatePoseBy(pose: UniversalPose, dx: number, dy: number) {
  const joints = cloneJoints(pose.joints);

  for (const joint of joints) {
    joint.x += dx;
    joint.y += dy;
  }

  enforcePoseBounds(joints);

  return { ...pose, joints };
}

// Dragging the hip only crouches the figure vertically: the feet stay exactly
// where they are, the knees bend, and the hips can neither rise above the
// standing height (legs fully extended) nor drop below the feet.
function crouchByHips(pose: UniversalPose, y: number) {
  const joints = cloneJoints(pose.joints);
  const hips = findJoint(joints, "hips");
  const leftKnee = findJoint(joints, "leftKnee");
  const rightKnee = findJoint(joints, "rightKnee");
  const leftAnkle = findJoint(joints, "leftAnkle");
  const rightAnkle = findJoint(joints, "rightAnkle");

  if (!hips || !leftKnee || !rightKnee || !leftAnkle || !rightAnkle) {
    return pose;
  }

  const leftThigh = Math.hypot(leftKnee.x - hips.x, leftKnee.y - hips.y);
  const leftShin = Math.hypot(leftAnkle.x - leftKnee.x, leftAnkle.y - leftKnee.y);
  const rightThigh = Math.hypot(rightKnee.x - hips.x, rightKnee.y - hips.y);
  const rightShin = Math.hypot(rightAnkle.x - rightKnee.x, rightAnkle.y - rightKnee.y);

  // The hips can't drop below the feet, and the reach clamp keeps them from
  // rising past fully-extended legs.
  const feetLevel = Math.min(leftAnkle.y, rightAnkle.y) - 0.03;
  let target = { x: hips.x, y: clamp(y, POSE_MIN_Y, feetLevel) };
  target = clampHipReach(target, leftAnkle, leftThigh + leftShin);
  target = clampHipReach(target, rightAnkle, rightThigh + rightShin);

  const yDelta = target.y - hips.y;
  for (const jointName of UPPER_BODY_JOINTS) {
    const joint = findJoint(joints, jointName);
    if (joint) {
      joint.y += yDelta;
    }
  }

  solveKnee(hips, leftKnee, leftAnkle, leftThigh, leftShin, "left");
  solveKnee(hips, rightKnee, rightAnkle, rightThigh, rightShin, "right");

  enforcePoseBounds(joints);

  return { ...pose, joints };
}

function clampHipReach(target: { x: number; y: number }, ankle: UniversalJoint, maxReach: number) {
  const dx = target.x - ankle.x;
  const dy = target.y - ankle.y;
  const distance = Math.hypot(dx, dy);
  const limit = maxReach - 0.001;

  if (distance <= limit || distance === 0) {
    return target;
  }

  const scale = limit / distance;
  return { x: ankle.x + dx * scale, y: ankle.y + dy * scale };
}

// Two-bone inverse kinematics: places the knee so the thigh/shin lengths are
// preserved while the foot stays planted, bending the knee outward to the side.
function solveKnee(
  hips: UniversalJoint,
  knee: UniversalJoint,
  ankle: UniversalJoint,
  thigh: number,
  shin: number,
  side: "left" | "right"
) {
  const dx = ankle.x - hips.x;
  const dy = ankle.y - hips.y;
  const reach = Math.hypot(dx, dy);

  if (reach === 0) {
    return;
  }

  const minReach = Math.abs(thigh - shin) + 0.001;
  const maxReach = thigh + shin - 0.001;
  const distance = clamp(reach, minReach, maxReach);

  const ux = dx / reach;
  const uy = dy / reach;
  const along = (distance * distance + thigh * thigh - shin * shin) / (2 * distance);
  const height = Math.sqrt(Math.max(0, thigh * thigh - along * along));

  const baseX = hips.x + ux * along;
  const baseY = hips.y + uy * along;

  let normalX = -uy;
  let normalY = ux;
  const outwardSign = side === "left" ? -1 : 1;
  if ((normalX < 0 ? -1 : 1) !== outwardSign) {
    normalX = -normalX;
    normalY = -normalY;
  }

  knee.x = baseX + normalX * height;
  knee.y = baseY + normalY * height;
}

function applyPoseConstraints(pose: UniversalPose, activeJoint: JointName): UniversalPose {
  const joints = cloneJoints(pose.joints);

  enforceRotationLimits(joints);
  enforceLegSpread(joints, activeJoint);
  enforceRotationLimits(joints);
  enforcePoseBounds(joints);

  return { ...pose, joints };
}

// At least one ankle is considered grounded when it sits on (or just above) the
// floor line. Used to validate a pose before saving.
function hasGroundedFoot(pose: UniversalPose) {
  const leftAnkle = pose.joints.find((joint) => joint.name === "leftAnkle");
  const rightAnkle = pose.joints.find((joint) => joint.name === "rightAnkle");
  const tolerance = 0.02;

  return Boolean(
    (leftAnkle && leftAnkle.y >= GROUND_Y - tolerance) ||
      (rightAnkle && rightAnkle.y >= GROUND_Y - tolerance)
  );
}

function enforceLegSpread(joints: UniversalJoint[], activeJoint: JointName) {
  const hips = findJoint(joints, "hips");
  const leftAnkle = findJoint(joints, "leftAnkle");
  const rightAnkle = findJoint(joints, "rightAnkle");

  if (!hips || !leftAnkle || !rightAnkle) {
    return;
  }

  const leftAngle = normalizeDegrees(toDegrees(Math.atan2(leftAnkle.y - hips.y, leftAnkle.x - hips.x)));
  const rightAngle = normalizeDegrees(toDegrees(Math.atan2(rightAnkle.y - hips.y, rightAnkle.x - hips.x)));
  const spread = normalizeDegrees(leftAngle - rightAngle);

  if (spread <= MAX_LEG_SPREAD_DEGREES) {
    return;
  }

  if (activeJoint.startsWith("left")) {
    rotateLegTowardAngle(joints, "leftKnee", hips, rightAngle + MAX_LEG_SPREAD_DEGREES);
    return;
  }

  rotateLegTowardAngle(joints, "rightKnee", hips, leftAngle - MAX_LEG_SPREAD_DEGREES);
}

function applyWavePose(pose: UniversalPose, elapsedSeconds: number, _legSide: "left" | "right"): UniversalPose {
  const joints = cloneJoints(pose.joints);
  const t = elapsedSeconds;
  const leftArmWave = Math.sin(t * 21);
  const rightArmWave = Math.sin(t * 21 + Math.PI * 0.7);
  const leftLegWave = Math.sin(t * 16 + 1.3);
  const rightLegWave = Math.sin(t * 16.5 + Math.PI * 0.9);
  const torsoSway = Math.sin(t * 12.5) * 0.09;

  rotateByParent(joints, "neck", torsoSway);
  rotateByParent(joints, "leftElbow", -leftArmWave * 0.38);
  rotateByParent(joints, "rightElbow", -rightArmWave * 0.38);
  rotateByParent(joints, "leftWrist", leftArmWave * 0.46);
  rotateByParent(joints, "rightWrist", rightArmWave * 0.46);
  // Legs flail freely too; the feet are no longer pinned to the floor.
  rotateByParent(joints, "leftKnee", leftLegWave * 0.2);
  rotateByParent(joints, "rightKnee", rightLegWave * 0.2);
  rotateByParent(joints, "leftAnkle", -leftLegWave * 0.28);
  rotateByParent(joints, "rightAnkle", -rightLegWave * 0.28);

  return { ...pose, joints };
}

function getPosePoint(event: PointerEvent<SVGElement>, svg: SVGSVGElement | null) {
  if (!svg) {
    return null;
  }

  const screenMatrix = svg.getScreenCTM();

  if (!screenMatrix) {
    return null;
  }

  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const svgPoint = point.matrixTransform(screenMatrix.inverse());

  return {
    x: (svgPoint.x - dummyTranslateX) / dummyScale / universalHumanSize.width,
    y: (svgPoint.y - dummyTranslateY) / dummyScale / universalHumanSize.height
  };
}

function getTorsoCenter(jointMap: Map<JointName, UniversalJoint>) {
  const neck = jointMap.get("neck");
  const hips = jointMap.get("hips");

  if (!neck || !hips) {
    return { x: 0.5, y: 0.39 };
  }

  return {
    x: (neck.x + hips.x) / 2,
    y: (neck.y + hips.y) / 2
  };
}

function findJoint(joints: UniversalJoint[], name: JointName) {
  return joints.find((joint) => joint.name === name);
}

function cloneJoints(joints: UniversalJoint[]) {
  return joints.map((joint) => ({ ...joint }));
}

function enforceRotationLimits(joints: UniversalJoint[]) {
  for (const jointName of Object.keys(jointRotationLimits) as JointName[]) {
    const parentName = jointParents[jointName];
    const parent = parentName ? findJoint(joints, parentName) : null;
    const joint = findJoint(joints, jointName);

    if (!parent || !joint) {
      continue;
    }

    const currentAngle = Math.atan2(joint.y - parent.y, joint.x - parent.x);
    const limitedAngle = clampJointAngle(jointName, currentAngle);
    rotateChain(joints, jointName, parent, shortestAngleDelta(currentAngle, limitedAngle));
  }
}

function rotateByParent(joints: UniversalJoint[], jointName: JointName, angleDelta: number) {
  const parentName = jointParents[jointName];
  const parent = parentName ? findJoint(joints, parentName) : null;
  const joint = findJoint(joints, jointName);

  if (!parent || !joint) {
    return;
  }

  const currentAngle = Math.atan2(joint.y - parent.y, joint.x - parent.x);
  const nextAngle = clampJointAngle(jointName, currentAngle + angleDelta);
  rotateChain(joints, jointName, parent, shortestAngleDelta(currentAngle, nextAngle));
}

function rotateChain(joints: UniversalJoint[], rootName: JointName, pivot: UniversalJoint, angleDelta: number) {
  const root = findJoint(joints, rootName);

  if (!root) {
    return;
  }

  const namesToRotate = getSubtreeJointNames(rootName);

  for (const name of namesToRotate) {
    const joint = findJoint(joints, name);

    if (joint) {
      rotatePointAround(joint, pivot, angleDelta);
    }
  }
}

function getSubtreeJointNames(rootName: JointName): JointName[] {
  return [rootName, ...jointChildren[rootName].flatMap((childName) => getSubtreeJointNames(childName))];
}

function rotatePointAround(joint: UniversalJoint, pivot: UniversalJoint, angleDelta: number) {
  const dx = joint.x - pivot.x;
  const dy = joint.y - pivot.y;
  const cos = Math.cos(angleDelta);
  const sin = Math.sin(angleDelta);

  joint.x = pivot.x + dx * cos - dy * sin;
  joint.y = pivot.y + dx * sin + dy * cos;
}

function enforcePoseBounds(joints: UniversalJoint[]) {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const joint of joints) {
    minX = Math.min(minX, joint.x);
    maxX = Math.max(maxX, joint.x);
    minY = Math.min(minY, joint.y);
    maxY = Math.max(maxY, joint.y);
  }

  let xDelta = 0;
  let yDelta = 0;

  if (minX < POSE_MIN_X) {
    xDelta = POSE_MIN_X - minX;
  }

  if (maxX + xDelta > POSE_MAX_X) {
    xDelta = POSE_MAX_X - maxX;
  }

  if (minY < POSE_MIN_Y) {
    yDelta = POSE_MIN_Y - minY;
  }

  if (maxY + yDelta > POSE_MAX_Y) {
    yDelta = POSE_MAX_Y - maxY;
  }

  if (xDelta === 0 && yDelta === 0) {
    return;
  }

  for (const joint of joints) {
    joint.x += xDelta;
    joint.y += yDelta;
  }
}

function rotateLegTowardAngle(
  joints: UniversalJoint[],
  legRootName: "leftKnee" | "rightKnee",
  hips: UniversalJoint,
  targetAnkleAngleDegrees: number
) {
  const ankleName = legRootName === "leftKnee" ? "leftAnkle" : "rightAnkle";
  const ankle = findJoint(joints, ankleName);

  if (!ankle) {
    return;
  }

  const currentAngle = Math.atan2(ankle.y - hips.y, ankle.x - hips.x);
  const targetAngle = (targetAnkleAngleDegrees * Math.PI) / 180;
  rotateChain(joints, legRootName, hips, shortestAngleDelta(currentAngle, targetAngle));
}

function shortestAngleDelta(from: number, to: number) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

function clampJointAngle(jointName: JointName, angleRadians: number) {
  const limit = jointRotationLimits[jointName];

  if (!limit) {
    return angleRadians;
  }

  const center = degreesToRadians(limit.centerDegrees);
  const radius = degreesToRadians(limit.radiusDegrees);
  const delta = clamp(shortestAngleDelta(center, angleRadians), -radius, radius);

  return center + delta;
}

function normalizeDegrees(degrees: number) {
  return ((degrees % 360) + 360) % 360;
}

function toDegrees(radians: number) {
  return (radians * 180) / Math.PI;
}

function degreesToRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
