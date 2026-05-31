import { universalHumanSize } from "./poses.js";
import type { JointName, UniversalJoint } from "./types.js";

/**
 * Shared "blob humanoid" geometry. Both the saboteur (SVG) and the athlete (canvas)
 * build their figure from this single source so the dummy AND the carved hole look
 * identical on every screen. Coordinates are in universal-box pixels (320 x 480); a
 * renderer maps them into its own space with a uniform scale + translate.
 */

export type FaceMode = "happy" | "squeeze";

export type FigureVec = { x: number; y: number };

/** A renderer-agnostic drawing primitive in universal-box pixel coordinates. */
export type FigurePrimitive =
  | { kind: "capsule"; a: FigureVec; b: FigureVec; width: number; fill: string }
  | { kind: "circle"; c: FigureVec; r: number; fill: string }
  | { kind: "ellipse"; c: FigureVec; rx: number; ry: number; fill: string }
  | { kind: "polyline"; points: FigureVec[]; width: number; stroke: string }
  | { kind: "quad"; from: FigureVec; control: FigureVec; to: FigureVec; width: number; stroke: string };

/** Blue body fill used for the blob dummy. */
export const BLOB_COLOR = "#2f86ff";
/** Near-black used for the face features. */
export const FACE_COLOR = "#0a0a0a";
/** How far the hole silhouette is inflated beyond the body (universal-box pixels). */
export const HOLE_PADDING = 20;

export type BuildBlobFigureOptions = {
  /** Inflate every body part by this many universal-box pixels (for the hole cutout). */
  pad?: number;
  /** Fill color for the body. */
  color?: string;
  /** Draw the face (eyes/nose/mouth). Off for the hole silhouette. */
  withFace?: boolean;
  /** Which expression to draw when `withFace` is set. */
  faceMode?: FaceMode;
  /** Stroke/fill color for the face features. */
  faceColor?: string;
};

/**
 * Build the list of primitives that make up the blob humanoid for a pose. The order
 * matches the original saboteur layering (legs first, head/face last) so stacking is
 * identical regardless of renderer.
 */
export function buildBlobFigure(
  joints: UniversalJoint[],
  options: BuildBlobFigureOptions = {}
): FigurePrimitive[] {
  const {
    pad = 0,
    color = BLOB_COLOR,
    withFace = false,
    faceMode = "happy",
    faceColor = FACE_COLOR
  } = options;

  const W = universalHumanSize.width;
  const H = universalHumanSize.height;
  const map = new Map(joints.map((joint) => [joint.name, joint]));
  const at = (name: JointName): FigureVec | null => {
    const joint = map.get(name);
    return joint ? { x: joint.x * W, y: joint.y * H } : null;
  };

  const head = at("head");
  const neck = at("neck");
  const leftShoulder = at("leftShoulder");
  const rightShoulder = at("rightShoulder");
  const leftElbow = at("leftElbow");
  const rightElbow = at("rightElbow");
  const leftWrist = at("leftWrist");
  const rightWrist = at("rightWrist");
  const hips = at("hips");
  const leftKnee = at("leftKnee");
  const rightKnee = at("rightKnee");
  const leftAnkle = at("leftAnkle");
  const rightAnkle = at("rightAnkle");

  const prims: FigurePrimitive[] = [];

  const cap = (a: FigureVec | null, b: FigureVec | null, width: number) => {
    if (a && b) {
      prims.push({ kind: "capsule", a, b, width: width + pad * 2, fill: color });
    }
  };
  const dot = (point: FigureVec | null, r: number) => {
    if (point) {
      prims.push({ kind: "circle", c: point, r: r + pad, fill: color });
    }
  };
  const foot = (point: FigureVec | null, rx: number, ry: number) => {
    if (point) {
      prims.push({ kind: "ellipse", c: { x: point.x, y: point.y + 2 }, rx: rx + pad, ry: ry + pad, fill: color });
    }
  };

  // Legs + feet.
  cap(hips, leftKnee, 38);
  cap(leftKnee, leftAnkle, 34);
  cap(hips, rightKnee, 38);
  cap(rightKnee, rightAnkle, 34);
  foot(leftAnkle, 19, 12);
  foot(rightAnkle, 19, 12);

  // Arms + hands.
  cap(leftShoulder, leftElbow, 28);
  cap(leftElbow, leftWrist, 26);
  cap(rightShoulder, rightElbow, 28);
  cap(rightElbow, rightWrist, 26);
  dot(leftWrist, 15);
  dot(rightWrist, 15);

  // Torso blob.
  cap(leftShoulder, rightShoulder, 44);
  cap(neck, hips, 50);
  dot(neck, 24);
  dot(hips, 27);

  // Neck link + head.
  cap(head, neck, 28);
  const headCenter = head ?? neck ?? { x: W / 2, y: H * 0.13 };
  prims.push({ kind: "ellipse", c: headCenter, rx: 50 + pad, ry: 58 + pad, fill: color });

  if (withFace) {
    prims.push(...buildFace(headCenter, faceMode, faceColor));
  }

  return prims;
}

/** Eyes / nose / mouth primitives, positioned relative to the head center. */
export function buildFace(headCenter: FigureVec, faceMode: FaceMode, color = FACE_COLOR): FigurePrimitive[] {
  const faceCx = headCenter.x;
  const faceCy = headCenter.y + 6;

  if (faceMode === "squeeze") {
    return [
      { kind: "polyline", stroke: color, width: 3.4, points: [
        { x: faceCx - 24, y: faceCy - 8 },
        { x: faceCx - 10, y: faceCy },
        { x: faceCx - 24, y: faceCy + 8 }
      ] },
      { kind: "polyline", stroke: color, width: 3.4, points: [
        { x: faceCx + 24, y: faceCy - 8 },
        { x: faceCx + 10, y: faceCy },
        { x: faceCx + 24, y: faceCy + 8 }
      ] },
      { kind: "polyline", stroke: color, width: 2.6, points: [
        { x: faceCx, y: faceCy + 2 },
        { x: faceCx, y: faceCy + 11 },
        { x: faceCx + 7, y: faceCy + 11 }
      ] },
      { kind: "quad", stroke: color, width: 3.4,
        from: { x: faceCx - 11, y: faceCy + 26 },
        control: { x: faceCx, y: faceCy + 16 },
        to: { x: faceCx + 11, y: faceCy + 26 } }
    ];
  }

  return [
    { kind: "ellipse", c: { x: faceCx - 16, y: faceCy - 4 }, rx: 6, ry: 9, fill: color },
    { kind: "ellipse", c: { x: faceCx + 16, y: faceCy - 4 }, rx: 6, ry: 9, fill: color },
    { kind: "polyline", stroke: color, width: 2.6, points: [
      { x: faceCx, y: faceCy + 4 },
      { x: faceCx, y: faceCy + 13 },
      { x: faceCx + 7, y: faceCy + 13 }
    ] },
    { kind: "quad", stroke: color, width: 3,
      from: { x: faceCx - 13, y: faceCy + 24 },
      control: { x: faceCx, y: faceCy + 36 },
      to: { x: faceCx + 13, y: faceCy + 24 } }
  ];
}
