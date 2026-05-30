import {
  DrawingUtils,
  FilesetResolver,
  PoseLandmarker,
  type PoseLandmarkerResult
} from "@mediapipe/tasks-vision";

/**
 * CDN assets for MediaPipe Pose Landmarker. The "lite" model keeps the demo snappy;
 * swap to _full / _heavy if accuracy matters more than latency. Requires network at
 * load time (fine for the hackathon; can be self-hosted later under /public).
 */
const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

let landmarkerPromise: Promise<PoseLandmarker> | null = null;

/** Lazily create (and cache) a single PoseLandmarker configured for video. */
export function getPoseLandmarker(): Promise<PoseLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = FilesetResolver.forVisionTasks(WASM_BASE).then((fileset) =>
      PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numPoses: 1
      })
    );
  }
  return landmarkerPromise;
}

export type PoseFrame = {
  result: PoseLandmarkerResult;
  /** First detected pose's landmarks, or undefined when no one is in frame. */
  landmarks: PoseLandmarkerResult["landmarks"][number] | undefined;
};

/**
 * Drives a per-frame detection loop against a playing <video>. Calls `onFrame` with
 * the latest landmarks each animation frame. Returns a stop() to cancel the loop.
 */
export function startPoseLoop(
  video: HTMLVideoElement,
  landmarker: PoseLandmarker,
  onFrame: (frame: PoseFrame) => void
): () => void {
  let rafId = 0;
  let lastVideoTime = -1;
  let stopped = false;

  const tick = () => {
    if (stopped) {
      return;
    }
    if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      const result = landmarker.detectForVideo(video, performance.now());
      onFrame({ result, landmarks: result.landmarks[0] });
    }
    rafId = requestAnimationFrame(tick);
  };

  rafId = requestAnimationFrame(tick);

  return () => {
    stopped = true;
    cancelAnimationFrame(rafId);
  };
}

export { DrawingUtils, PoseLandmarker };
