import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { cx, pillDanger } from "../lib/ui";

const TUTORIAL_SEEN_STORAGE_KEY = "quackhacks:saboteur:tutorialSeen";

type SpotlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type TutorialStep = {
  id: string;
  title: string;
  body: string;
  waitingHint: string;
  resolveTarget: () => Element | null;
  callout: "top" | "bottom" | "left" | "right" | "side" | "near";
  padding?: number;
  pulseTarget?: boolean;
  roundHighlight?: boolean;
  hideHighlightOnEngage?: boolean;
  /** User clicks Continue when ready — no auto-complete from a single action. */
  manualContinue?: boolean;
  /** Only advance after save actually succeeds (foot grounded, etc.). */
  requiresSuccessfulSave?: boolean;
  /** Continue button requires at least one foot on the floor. */
  requiresGroundedFoot?: boolean;
  /** Show target ring without blocking scrim — user can still interact elsewhere. */
  highlightOnly?: boolean;
};

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "make-pose",
    title: "Make a Pose",
    body: "Tap Make Pose to open a fresh T-pose on the stage. Every wall you send starts from here.",
    waitingHint: "Click Make Pose to continue",
    resolveTarget: () => document.querySelector('[aria-label^="Make Pose"]'),
    callout: "top",
    padding: 10
  },
  {
    id: "drag-torso",
    title: "Adjust the Torso",
    body: "Drag the hip joint to twist and reposition the torso.",
    waitingHint: "Drag the glowing hip joint",
    resolveTarget: () => document.querySelector('[data-tutorial-joint="hips"]'),
    callout: "near",
    padding: 18,
    pulseTarget: true,
    roundHighlight: true,
    hideHighlightOnEngage: true
  },
  {
    id: "drag-move",
    title: "Move the Dummy",
    body: "Grab the crosshair in the middle to lift and slide the whole figure across the stage.",
    waitingHint: "Drag the middle move handle",
    resolveTarget: () => document.querySelector("[data-tutorial-move-handle]"),
    callout: "near",
    padding: 16,
    pulseTarget: true,
    roundHighlight: true,
    hideHighlightOnEngage: true
  },
  {
    id: "drag-elbow",
    title: "Rotate a Limb",
    body: "Drag the highlighted elbow joint to bend the arm. Every blue dot is a joint you can rotate.",
    waitingHint: "Drag the glowing elbow handle",
    resolveTarget: () => document.querySelector('[data-tutorial-joint="rightElbow"]'),
    callout: "near",
    padding: 18,
    pulseTarget: true,
    roundHighlight: true,
    hideHighlightOnEngage: true
  },
  {
    id: "edit-pose",
    title: "Keep Refining",
    body: "You know the moves now — keep tweaking until it feels right. At least one foot must touch the floor before you continue.",
    waitingHint: "Ground a foot on the floor, then continue",
    resolveTarget: () => null,
    callout: "near",
    manualContinue: true,
    requiresGroundedFoot: true
  },
  {
    id: "preview-hole",
    title: "Preview the Hole",
    body: "Preview Hole shows the wall cutout the athlete will have to match — check your shape before you send it.",
    waitingHint: "Try Preview Hole, then continue",
    resolveTarget: () =>
      document.querySelector('[aria-label^="Preview Hole"]') ??
      document.querySelector('[aria-label^="Hide Hole"]'),
    callout: "top",
    padding: 10,
    manualContinue: true,
    highlightOnly: true
  },
  {
    id: "save-pose",
    title: "Save to Your Deck",
    body: "Like what you made? Save Pose adds it to your personal deck. At least one foot must touch the floor — lower the dummy if save fails.",
    waitingHint: "Click Save Pose to continue",
    resolveTarget: () => document.querySelector('[aria-label^="Save Pose"]'),
    callout: "top",
    padding: 10,
    requiresSuccessfulSave: true
  },
  {
    id: "pick-deck",
    title: "Pick from the Deck",
    body: "Tap any card in the Deck to load a preset or one of your saved poses onto the stage.",
    waitingHint: "Select a deck card",
    resolveTarget: () => findDeckScrollTarget(),
    callout: "left",
    padding: 6
  },
  {
    id: "randomize",
    title: "Roll the Dice",
    body: "Stuck? Hit randomize to pull a surprise pose from the deck.",
    waitingHint: "Click the randomize button",
    resolveTarget: () => document.querySelector('[aria-label^="Randomize pose"]'),
    callout: "left",
    padding: 10
  },
  {
    id: "send-pose",
    title: "Send the Wall",
    body: "Send Pose pushes the current pose to the athlete as their next hole to match.",
    waitingHint: "Click Send Pose to continue",
    resolveTarget: () => document.querySelector('[aria-label^="Send Pose"]'),
    callout: "top",
    padding: 10
  },
  {
    id: "sabotages",
    title: "Sabotage Tools",
    body: "You'll earn sabotages to mess with the athlete — blindness, mirror mode, and more. Check this panel during play; full details are in the docs later.",
    waitingHint: "Read up, then start sabotaging",
    resolveTarget: () => findPanelByHeading("Sabotage Tools"),
    callout: "left",
    padding: 12
  }
];

const SAVE_FOOT_ERROR_HINT = "One foot must touch the floor. Lower the pose, then save again.";

function findPanelByHeading(label: string): Element | null {
  const heading = Array.from(document.querySelectorAll("h2")).find((el) => el.textContent?.trim() === label);
  if (!heading) {
    return null;
  }

  let node: Element | null = heading;
  while (node) {
    if (node.tagName === "DIV" && node.className.includes("rounded-[18px]")) {
      return node;
    }
    node = node.parentElement;
  }

  return heading.closest("aside") ?? heading.parentElement;
}

function findEditorSvg(): SVGSVGElement | null {
  return document.querySelector('svg[aria-label="Editable saboteur pose"]');
}

function findStageElement(): Element | null {
  return findEditorSvg()?.closest(".relative") ?? findEditorSvg();
}

function scrollDeckToTop() {
  const deckScroll = document.querySelector("[data-saboteur-deck-scroll]");
  if (deckScroll instanceof HTMLElement) {
    deckScroll.scrollTop = 0;
  }
}

function findDeckScrollTarget(): Element | null {
  return document.querySelector("[data-saboteur-deck-scroll]");
}

function hasSaveErrorToast(): boolean {
  return Boolean(document.querySelector("[data-saboteur-save-error]"));
}

function isFootGrounded(): boolean {
  return findEditorSvg()?.getAttribute("data-foot-grounded") === "true";
}

function waitForTutorialTarget(resolve: () => Element | null, onFound: () => void, maxAttempts = 24) {
  const attempt = (count: number) => {
    if (resolve()) {
      onFound();
      return;
    }
    if (count < maxAttempts) {
      requestAnimationFrame(() => attempt(count + 1));
    }
  };

  if (resolve()) {
    onFound();
    return;
  }

  requestAnimationFrame(() => attempt(0));
}

function isWithinTutorialTarget(target: EventTarget | null, selector: string): boolean {
  return target instanceof Element && Boolean(target.closest(selector));
}

function readTutorialSeen(): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  return window.localStorage.getItem(TUTORIAL_SEEN_STORAGE_KEY) === "true";
}

function persistTutorialSeen() {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(TUTORIAL_SEEN_STORAGE_KEY, "true");
  }
}

function useSplashDismissed(): boolean {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof document === "undefined") {
      return false;
    }
    return !document.querySelector(".sabotage-splash");
  });

  useEffect(() => {
    if (dismissed) {
      return;
    }

    const check = () => {
      if (!document.querySelector(".sabotage-splash")) {
        setDismissed(true);
      }
    };

    check();
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [dismissed]);

  return dismissed;
}

function useSpotlightRect(
  resolveTarget: () => Element | null,
  active: boolean,
  padding: number,
  frozen: boolean
): SpotlightRect | null {
  const [rect, setRect] = useState<SpotlightRect | null>(null);

  const update = useCallback(() => {
    if (frozen) {
      return;
    }

    const el = resolveTarget();
    if (!el) {
      setRect(null);
      return;
    }

    const bounds = el.getBoundingClientRect();
    setRect({
      top: bounds.top - padding,
      left: bounds.left - padding,
      width: bounds.width + padding * 2,
      height: bounds.height + padding * 2
    });
  }, [frozen, padding, resolveTarget]);

  useEffect(() => {
    if (!active || frozen) {
      if (!active) {
        setRect(null);
      }
      return;
    }

    update();

    const el = resolveTarget();
    const resizeObserver = el ? new ResizeObserver(update) : null;
    if (el && resizeObserver) {
      resizeObserver.observe(el);
    }

    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    const retryTimer = window.setInterval(update, 160);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.clearInterval(retryTimer);
    };
  }, [active, frozen, resolveTarget, update]);

  return rect;
}

function calloutStyle(rect: SpotlightRect | null, placement: TutorialStep["callout"]): CSSProperties {
  const margin = 16;
  const maxWidth = 320;

  if (placement === "near") {
    return { top: "50%", left: "50%", transform: "translate(-50%, -50%)", maxWidth: 300 };
  }

  if (!rect) {
    return { top: "50%", left: "50%", transform: "translate(-50%, -50%)", maxWidth: 360 };
  }

  switch (placement) {
    case "top":
      return {
        left: Math.max(16, Math.min(rect.left + rect.width / 2, window.innerWidth - maxWidth - 16)),
        bottom: window.innerHeight - rect.top + margin,
        transform: "translateX(-50%)",
        maxWidth
      };
    case "bottom":
      return {
        left: Math.max(16, Math.min(rect.left + rect.width / 2, window.innerWidth - maxWidth - 16)),
        top: rect.top + rect.height + margin,
        transform: "translateX(-50%)",
        maxWidth
      };
    case "left":
      return {
        right: window.innerWidth - rect.left + margin,
        top: Math.max(16, Math.min(rect.top + rect.height / 2, window.innerHeight - 200)),
        transform: "translateY(-50%)",
        maxWidth
      };
    case "right":
      return {
        left: rect.left + rect.width + margin,
        top: Math.max(16, Math.min(rect.top + rect.height / 2, window.innerHeight - 200)),
        transform: "translateY(-50%)",
        maxWidth
      };
    default:
      return { top: "50%", left: "50%", transform: "translate(-50%, -50%)", maxWidth: 360 };
  }
}

function nearStageCalloutStyle(
  stageRect: SpotlightRect | null,
  jointRect: SpotlightRect | null,
  stepId: string
): CSSProperties {
  const maxWidth = 228;
  const gap = 12;

  if (!stageRect) {
    return calloutStyle(null, "near");
  }

  if (stepId === "edit-pose") {
    // Near the dashed border's upper-left corner — slightly inset from the stage edge.
    return {
      left: stageRect.left + stageRect.width * 0.1 + 12,
      top: stageRect.top + stageRect.height * 0.17 + 6,
      maxWidth: Math.min(maxWidth, stageRect.width * 0.36)
    };
  }

  if (stepId === "drag-elbow") {
    return {
      left: stageRect.left + 10,
      top: Math.max(16, Math.min(jointRect ? jointRect.top - gap : stageRect.top + 10, stageRect.top + stageRect.height * 0.14)),
      maxWidth: Math.min(maxWidth, stageRect.width * 0.34)
    };
  }

  if (stepId === "drag-torso") {
    return {
      left: stageRect.left + stageRect.width * 0.58,
      top: Math.max(16, stageRect.top + stageRect.height * 0.1),
      maxWidth: Math.min(maxWidth, stageRect.width * 0.34)
    };
  }

  if (stepId === "drag-move") {
    return {
      left: stageRect.left + stageRect.width * 0.56,
      top: stageRect.top + stageRect.height * 0.28,
      maxWidth: Math.min(maxWidth, stageRect.width * 0.36)
    };
  }

  return calloutStyle(null, "near");
}

function resolveCalloutStyle(
  step: TutorialStep,
  jointRect: SpotlightRect | null,
  stageRect: SpotlightRect | null
): CSSProperties {
  if (step.callout === "near") {
    return nearStageCalloutStyle(stageRect, jointRect, step.id);
  }

  return calloutStyle(jointRect, step.callout);
}

function ScrimPanels({ rect }: { rect: SpotlightRect }) {
  const panels: Array<{ style: CSSProperties }> = [
    { style: { top: 0, left: 0, right: 0, height: rect.top } },
    { style: { top: rect.top, left: 0, width: rect.left, height: rect.height } },
    { style: { top: rect.top, left: rect.left + rect.width, right: 0, height: rect.height } },
    { style: { top: rect.top + rect.height, left: 0, right: 0, bottom: 0 } }
  ];

  return (
    <>
      {panels.map((panel, index) => (
        <div key={index} className="saboteur-tutorial-scrim-panel" style={panel.style} aria-hidden="true" />
      ))}
    </>
  );
}

function useTargetEngaged(
  step: TutorialStep,
  active: boolean,
  targetEngaged: boolean,
  onEngage: () => void
) {
  const onEngageRef = useRef(onEngage);

  useEffect(() => {
    onEngageRef.current = onEngage;
  }, [onEngage]);

  useEffect(() => {
    if (!active || !step.hideHighlightOnEngage || targetEngaged) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const targetEl = step.resolveTarget();
      if (!targetEl) {
        return;
      }
      if (targetEl === event.target || targetEl.contains(event.target as Node)) {
        onEngageRef.current();
      }
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [active, step, targetEngaged]);
}

function useStepCompletion(
  stepId: string,
  active: boolean,
  onComplete: () => void,
  onSaveFailed: () => void,
  onDismissHighlight: () => void
) {
  const completedRef = useRef(false);
  const deckAnchorRef = useRef<Element | null>(null);
  const onCompleteRef = useRef(onComplete);
  const onSaveFailedRef = useRef(onSaveFailed);
  const onDismissHighlightRef = useRef(onDismissHighlight);
  const dragRef = useRef({ active: false, startX: 0, startY: 0 });

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    onSaveFailedRef.current = onSaveFailed;
  }, [onSaveFailed]);

  useEffect(() => {
    onDismissHighlightRef.current = onDismissHighlight;
  }, [onDismissHighlight]);

  useEffect(() => {
    if (!active) {
      completedRef.current = false;
      dragRef.current.active = false;
      return;
    }

    if (stepId === "edit-pose" || stepId === "preview-hole" || stepId === "sabotages") {
      return;
    }

    completedRef.current = false;
    dragRef.current = { active: false, startX: 0, startY: 0 };
    deckAnchorRef.current = document.querySelector('[aria-label^="Select"][aria-pressed="true"]');

    const complete = () => {
      if (completedRef.current) {
        return;
      }
      completedRef.current = true;
      dragRef.current.active = false;
      onCompleteRef.current();
    };

    if (stepId === "drag-elbow" || stepId === "drag-torso" || stepId === "drag-move") {
      const selector =
        stepId === "drag-elbow"
          ? '[data-tutorial-joint="rightElbow"]'
          : stepId === "drag-torso"
            ? '[data-tutorial-joint="hips"]'
            : "[data-tutorial-move-handle]";

      const onPointerDown = (event: PointerEvent) => {
        if (!isWithinTutorialTarget(event.target, selector)) {
          return;
        }
        dragRef.current = { active: true, startX: event.clientX, startY: event.clientY };
      };

      const finishDrag = (event: PointerEvent) => {
        const drag = dragRef.current;
        if (!drag.active) {
          return;
        }
        dragRef.current.active = false;
        const moved = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
        if (moved >= 8) {
          complete();
        }
      };

      document.addEventListener("pointerdown", onPointerDown, true);
      document.addEventListener("pointerup", finishDrag, true);
      document.addEventListener("pointercancel", finishDrag, true);
      return () => {
        document.removeEventListener("pointerdown", onPointerDown, true);
        document.removeEventListener("pointerup", finishDrag, true);
        document.removeEventListener("pointercancel", finishDrag, true);
      };
    }

    if (stepId === "make-pose") {
      const onClick = (event: Event) => {
        if (!(event.target as Element).closest('[aria-label^="Make Pose"]')) {
          return;
        }

        // Bubble phase so Make Pose runs first; wait for the editor joint before advancing.
        waitForTutorialTarget(
          () => document.querySelector('[data-tutorial-joint="hips"]'),
          () => complete()
        );
      };
      document.addEventListener("click", onClick, false);
      return () => document.removeEventListener("click", onClick, false);
    }

    if (stepId === "save-pose") {
      const onClick = (event: Event) => {
        if (!(event.target as Element).closest('[aria-label^="Save Pose"]')) {
          return;
        }

        const poll = window.setInterval(() => {
          if (hasSaveErrorToast()) {
            window.clearInterval(poll);
            onSaveFailedRef.current();
            return;
          }
          if (!findEditorSvg()) {
            window.clearInterval(poll);
            complete();
          }
        }, 100);

        window.setTimeout(() => window.clearInterval(poll), 6000);
      };

      document.addEventListener("click", onClick, true);
      return () => document.removeEventListener("click", onClick, true);
    }

    if (stepId === "pick-deck") {
      const onClick = (event: Event) => {
        const card = (event.target as Element).closest('[aria-label^="Select"]');
        if (!card || card === deckAnchorRef.current) {
          return;
        }
        complete();
      };

      document.addEventListener("click", onClick, true);
      return () => document.removeEventListener("click", onClick, true);
    }

    if (stepId === "randomize") {
      const onClick = (event: Event) => {
        if ((event.target as Element).closest('[aria-label^="Randomize pose"]')) {
          complete();
        }
      };

      document.addEventListener("click", onClick, true);
      return () => document.removeEventListener("click", onClick, true);
    }

    if (stepId === "send-pose") {
      const onClick = (event: Event) => {
        if ((event.target as Element).closest('[aria-label^="Send Pose"]')) {
          complete();
        }
      };

      document.addEventListener("click", onClick, true);
      return () => document.removeEventListener("click", onClick, true);
    }
  }, [active, onDismissHighlight, onSaveFailed, stepId]);
}

export function SaboteurTutorialOverlay({ runKey = 0 }: { runKey?: number }) {
  const splashDismissed = useSplashDismissed();
  const [visible, setVisible] = useState(() => !readTutorialSeen());
  const [stepIndex, setStepIndex] = useState(0);
  const [targetEngaged, setTargetEngaged] = useState(false);
  const [statusOverride, setStatusOverride] = useState<string | null>(null);
  const [footGrounded, setFootGrounded] = useState(false);

  useEffect(() => {
    if (runKey <= 0) {
      return;
    }
    setVisible(true);
    setStepIndex(0);
    setTargetEngaged(false);
    setStatusOverride(null);
  }, [runKey]);

  const step = TUTORIAL_STEPS[stepIndex];
  const active = visible && splashDismissed;

  useEffect(() => {
    if (!active) {
      return;
    }

    scrollDeckToTop();
    const retryTimer = window.setInterval(scrollDeckToTop, 120);
    const stopRetry = window.setTimeout(() => window.clearInterval(retryTimer), 2500);

    return () => {
      window.clearInterval(retryTimer);
      window.clearTimeout(stopRetry);
    };
  }, [active, runKey]);

  const isNearCallout = step.callout === "near";
  const hasSpotlight = Boolean(step.resolveTarget());
  const showHighlight = Boolean(step.hideHighlightOnEngage ? !targetEngaged : hasSpotlight);
  const trackJointRect = active && (showHighlight || isNearCallout);
  const rect = useSpotlightRect(step.resolveTarget, trackJointRect && hasSpotlight, step.padding ?? 10, false);
  const stageRect = useSpotlightRect(() => findStageElement(), active && isNearCallout, 0, false);

  useEffect(() => {
    if (!active || !step.requiresGroundedFoot) {
      setFootGrounded(false);
      return;
    }

    const update = () => setFootGrounded(isFootGrounded());
    update();
    const timer = window.setInterval(update, 160);
    return () => window.clearInterval(timer);
  }, [active, step.requiresGroundedFoot, stepIndex]);

  useEffect(() => {
    if (footGrounded && step.requiresGroundedFoot && statusOverride === SAVE_FOOT_ERROR_HINT) {
      setStatusOverride(null);
    }
  }, [footGrounded, step.requiresGroundedFoot, statusOverride]);

  const finish = useCallback(() => {
    persistTutorialSeen();
    setVisible(false);
  }, []);

  const goNext = useCallback(() => {
    if (stepIndex >= TUTORIAL_STEPS.length - 1) {
      finish();
      return;
    }
    setStepIndex((current) => current + 1);
    setTargetEngaged(false);
    setStatusOverride(null);
  }, [finish, stepIndex]);

  useEffect(() => {
    setTargetEngaged(false);
    setStatusOverride(null);
  }, [stepIndex]);

  const dismissHighlight = useCallback(() => {
    setTargetEngaged(true);
  }, []);

  useTargetEngaged(step, active, targetEngaged, dismissHighlight);

  const handleStepComplete = useCallback(() => {
    setStatusOverride(null);
    goNext();
  }, [goNext]);

  const handleSaveFailed = useCallback(() => {
    setStatusOverride(SAVE_FOOT_ERROR_HINT);
  }, []);

  useStepCompletion(step.id, active, handleStepComplete, handleSaveFailed, dismissHighlight);

  if (!active) {
    return null;
  }

  const isLastStep = step.id === "sabotages";
  const highlightClass = step.roundHighlight ? "saboteur-tutorial-ring-round" : "saboteur-tutorial-ring-rect";
  const statusHint = statusOverride ?? step.waitingHint;
  const statusIsError = Boolean(statusOverride);
  const showAutoStepStatus = !step.manualContinue && !isLastStep;
  const canContinueEdit = !step.requiresGroundedFoot || footGrounded;
  const showScrim = Boolean(rect && showHighlight && !step.highlightOnly);

  return (
    <div className="saboteur-tutorial-root" role="dialog" aria-modal="true" aria-labelledby="saboteur-tutorial-title">
      {showScrim ? <ScrimPanels rect={rect!} /> : null}

      {rect && showHighlight ? (
        <>
          <div
            className={cx("saboteur-tutorial-ring", highlightClass)}
            style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
            aria-hidden="true"
          />
          {step.pulseTarget ? (
            <div
              className="saboteur-tutorial-pulse"
              style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
              aria-hidden="true"
            />
          ) : null}
        </>
      ) : null}

      <div
        className={cx("saboteur-tutorial-callout", isNearCallout && "saboteur-tutorial-callout-compact")}
        style={resolveCalloutStyle(step, rect, stageRect)}
      >
        <div className="saboteur-tutorial-callout-header">
          <p className="saboteur-tutorial-kicker">
            Briefing {stepIndex + 1}/{TUTORIAL_STEPS.length}
          </p>
          <button type="button" className="saboteur-tutorial-skip" onClick={finish}>
            Skip
          </button>
        </div>

        <h2 id="saboteur-tutorial-title" className="saboteur-tutorial-title">
          {step.title}
        </h2>
        <p className="saboteur-tutorial-body">{step.body}</p>

        {isLastStep ? (
          <button type="button" className={cx(pillDanger, "saboteur-tutorial-finish min-h-0 w-full px-4 py-2.5 text-sm")} onClick={finish}>
            Start the sabotage!
          </button>
        ) : step.manualContinue ? (
          <div className="saboteur-tutorial-actions">
            <p className={cx("saboteur-tutorial-status m-0 flex-1", statusIsError && "saboteur-tutorial-status-error")}>
              {statusHint}
            </p>
            <button
              type="button"
              className={cx(pillDanger, "min-h-0 shrink-0 px-4 py-2 text-xs", !canContinueEdit && "opacity-45")}
              disabled={!canContinueEdit}
              onClick={() => {
                if (!canContinueEdit) {
                  setStatusOverride(SAVE_FOOT_ERROR_HINT);
                  return;
                }
                goNext();
              }}
            >
              Continue
            </button>
          </div>
        ) : showAutoStepStatus ? (
          <p className={cx("saboteur-tutorial-status", statusIsError && "saboteur-tutorial-status-error")}>{statusHint}</p>
        ) : null}

        <div className="saboteur-tutorial-dots" aria-hidden="true">
          {TUTORIAL_STEPS.map((entry, index) => (
            <span key={entry.id} className={cx("saboteur-tutorial-dot", index === stepIndex && "saboteur-tutorial-dot-active")} />
          ))}
        </div>
      </div>
    </div>
  );
}
