import {
  DrawingUtils,
  FilesetResolver,
  HandLandmarker,
  PoseLandmarker,
  type NormalizedLandmark,
  type PoseLandmarkerResult
} from "@mediapipe/tasks-vision";

/**
 * CDN assets for MediaPipe Pose / Hand Landmarkers. The "lite"/default models keep
 * the demo snappy. Requires network at load time (fine for the hackathon; can be
 * self-hosted later under /public).
 */
const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const POSE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";
const HAND_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

let posePromise: Promise<PoseLandmarker> | null = null;
let handPromise: Promise<HandLandmarker> | null = null;

/** Lazily create (and cache) a single PoseLandmarker configured for video. */
export function getPoseLandmarker(): Promise<PoseLandmarker> {
  if (!posePromise) {
    posePromise = FilesetResolver.forVisionTasks(WASM_BASE).then((fileset) =>
      PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: POSE_MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numPoses: 1
      })
    );
  }
  return posePromise;
}

/** Lazily create (and cache) a HandLandmarker (up to two hands) configured for video. */
export function getHandLandmarker(): Promise<HandLandmarker> {
  if (!handPromise) {
    handPromise = FilesetResolver.forVisionTasks(WASM_BASE).then((fileset) =>
      HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numHands: 2
      })
    );
  }
  return handPromise;
}

export type HandInfo = {
  /** 21 normalized hand landmarks. */
  landmarks: NormalizedLandmark[];
  /** MediaPipe handedness label ("Left" / "Right") from the camera's perspective. */
  handedness: string;
  /** True when the hand is making a grab/fist. */
  closed: boolean;
};

export type PoseFrame = {
  result: PoseLandmarkerResult;
  /** First detected pose's landmarks, or undefined when no one is in frame. */
  landmarks: PoseLandmarkerResult["landmarks"][number] | undefined;
  /** Detected hands with their open/closed (grab) state. */
  hands: HandInfo[];
};

/**
 * Grab detector: a finger is "curled" when its tip sits closer to the wrist than its
 * middle (PIP) joint. If most fingers are curled the hand is closed (a fist/grab).
 */
export function isHandClosed(landmarks: NormalizedLandmark[]): boolean {
  const wrist = landmarks[0];
  if (!wrist) {
    return false;
  }
  const tips = [8, 12, 16, 20];
  const pips = [6, 10, 14, 18];
  const dist = (a: NormalizedLandmark, b: NormalizedLandmark) => Math.hypot(a.x - b.x, a.y - b.y);

  let curled = 0;
  for (let i = 0; i < tips.length; i += 1) {
    const tip = landmarks[tips[i]];
    const pip = landmarks[pips[i]];
    if (tip && pip && dist(tip, wrist) < dist(pip, wrist)) {
      curled += 1;
    }
  }
  return curled >= 3;
}

/**
 * Drives a per-frame detection loop against a playing <video>. Runs the pose detector
 * and (optionally) the hand detector, then calls `onFrame` with the latest data.
 * Returns a stop() to cancel the loop.
 */
export function startPoseLoop(
  video: HTMLVideoElement,
  poseLandmarker: PoseLandmarker,
  onFrame: (frame: PoseFrame) => void,
  handLandmarker?: HandLandmarker | null
): () => void {
  let rafId = 0;
  let lastVideoTime = -1;
  let stopped = false;

  const tick = () => {
    if (stopped) {
      return;
    }
    // A single bad frame (a transient MediaPipe glitch, an off-screen-limb edge case, or a
    // throw inside onFrame) must never kill the loop — otherwise the dummy/hole freeze in
    // place forever. Catch per-frame errors and always reschedule in `finally`.
    try {
      if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        const ts = performance.now();
        const result = poseLandmarker.detectForVideo(video, ts);

        const hands: HandInfo[] = [];
        if (handLandmarker) {
          const handResult = handLandmarker.detectForVideo(video, ts);
          handResult.landmarks.forEach((landmarks, index) => {
            hands.push({
              landmarks,
              handedness: handResult.handedness[index]?.[0]?.categoryName ?? "Unknown",
              closed: isHandClosed(landmarks)
            });
          });
        }

        onFrame({ result, landmarks: result.landmarks[0], hands });
      }
    } catch (err) {
      console.error("pose loop frame error (continuing)", err);
    } finally {
      if (!stopped) {
        rafId = requestAnimationFrame(tick);
      }
    }
  };

  rafId = requestAnimationFrame(tick);

  return () => {
    stopped = true;
    cancelAnimationFrame(rafId);
  };
}

export { DrawingUtils, PoseLandmarker, HandLandmarker };
