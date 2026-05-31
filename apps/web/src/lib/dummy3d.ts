import type p5 from "p5";
import { BLOB_COLOR, FACE_COLOR, type FaceMode, type JointName } from "@quackhacks/shared";

// ── Shared 3D blob dummy renderer (p5.js WEBGL) ───────────────────────────────
// Both the athlete (posing) page and the saboteur page render the exact same
// shaded, pill-shaped blob dummy from this module so they look and act identical.
// Each caller supplies a `JointAccessor` that maps universal joint names into its
// own canvas-pixel space plus a uniform scale `s` (universal-box pixel → canvas
// pixel); everything else — geometry, lighting, face — is shared here.

/** A point in canvas-pixel space (origin top-left; WEBGL centering is handled here). */
export type ScreenPoint = { x: number; y: number };

/** Maps a universal joint name to its canvas-pixel position (or null if missing). */
export type JointAccessor = (name: JointName) => ScreenPoint | null;

/** Which hands are currently in a grabbing/closed state (turned red). */
export type HandClosed = { left: boolean; right: boolean };

/** A closed/grabbing hand turns red so the grab reads at a glance. */
export const HAND_GRAB_COLOR = "#ff2424";

/** A finite, drawable point — guards WebGL against NaN/Infinity coords that freeze it. */
function okPoint(point: ScreenPoint | null): point is ScreenPoint {
  return !!point && Number.isFinite(point.x) && Number.isFinite(point.y);
}

/** A 3D sphere centered at a screen point (z = 0 plane). */
export function sphere3D(p: p5, point: ScreenPoint | null, r: number) {
  if (!okPoint(point) || !(r > 0)) {
    return;
  }
  p.push();
  p.translate(point.x, point.y, 0);
  p.sphere(r);
  p.pop();
}

/** A 3D capsule: a cylinder between two screen points, capped with spheres for a pill look. */
export function capsule3D(p: p5, a: ScreenPoint | null, b: ScreenPoint | null, r: number) {
  if (!okPoint(a) || !okPoint(b) || !(r > 0)) {
    return;
  }
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len > 0.5) {
    p.push();
    p.translate((a.x + b.x) / 2, (a.y + b.y) / 2, 0);
    // p5 cylinders run along +y; rotate that axis onto the bone direction.
    p.rotateZ(Math.atan2(-dx, dy));
    p.cylinder(r, len);
    p.pop();
  }
  sphere3D(p, a, r);
  sphere3D(p, b, r);
}

/** A foot as a flattened 3D ellipsoid sitting just below the ankle. */
export function foot3D(p: p5, ankle: ScreenPoint | null, rx: number, ry: number) {
  if (!okPoint(ankle) || !(rx > 0) || !(ry > 0)) {
    return;
  }
  p.push();
  p.translate(ankle.x, ankle.y + ry * 0.2, 0);
  p.ellipsoid(rx, ry, ry);
  p.pop();
}

/**
 * Draw the saboteur-style face on the front of the 3D head. Offsets mirror `buildFace`
 * in the shared figure module so the 3D dummy makes the exact same expressions the 2D
 * blob does: a "happy" face (eyes + L-nose + smile) and a "squeeze" face (scrunched
 * `>` `<` eyes + L-nose + frown) used while the dummy is being wiggled.
 */
export function drawFace3D(
  p: p5,
  headCenter: ScreenPoint,
  s: number,
  faceMode: FaceMode = "happy",
  eyesClosed = false
) {
  p.push();
  // Sit just in front of the head's front pole (rz = 50) so features aren't occluded.
  p.translate(headCenter.x, headCenter.y, 50.5 * s);

  if (faceMode === "squeeze") {
    // Scrunched eyes: a ">" on the left and a "<" on the right.
    p.noFill();
    p.stroke(FACE_COLOR);
    p.strokeWeight(3.4 * s);
    p.beginShape();
    p.vertex(-24 * s, -2 * s);
    p.vertex(-10 * s, 6 * s);
    p.vertex(-24 * s, 14 * s);
    p.endShape();
    p.beginShape();
    p.vertex(24 * s, -2 * s);
    p.vertex(10 * s, 6 * s);
    p.vertex(24 * s, 14 * s);
    p.endShape();

    // Nose: an L-shaped stroke.
    p.strokeWeight(2.6 * s);
    p.beginShape();
    p.vertex(0, 8 * s);
    p.vertex(0, 17 * s);
    p.vertex(7 * s, 17 * s);
    p.endShape();

    // Frown: a quadratic curve that dips up in the middle (from (-11,32) via (0,22) to (11,32)).
    p.strokeWeight(3.4 * s);
    p.beginShape();
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const mt = 1 - t;
      const px = (mt * mt * -11 + t * t * 11) * s;
      const py = (mt * mt * 32 + 2 * mt * t * 22 + t * t * 32) * s;
      p.vertex(px, py);
    }
    p.endShape();

    p.pop();
    return;
  }

  // Happy face: two eyes, an L-nose, a smile.
  if (eyesClosed) {
    p.noFill();
    p.stroke(FACE_COLOR);
    p.strokeWeight(3.4 * s);
    p.line(-22 * s, 2 * s, -10 * s, 2 * s);
    p.line(10 * s, 2 * s, 22 * s, 2 * s);
  } else {
    p.noStroke();
    p.fill(FACE_COLOR);
    p.ellipse(-16 * s, 2 * s, 12 * s, 18 * s);
    p.ellipse(16 * s, 2 * s, 12 * s, 18 * s);
  }

  // Nose: an L-shaped stroke.
  p.noFill();
  p.stroke(FACE_COLOR);
  p.strokeWeight(2.6 * s);
  p.beginShape();
  p.vertex(0, 10 * s);
  p.vertex(0, 19 * s);
  p.vertex(7 * s, 19 * s);
  p.endShape();

  // Smile: sample a quadratic curve from (-13,30) via control (0,42) to (13,30).
  p.strokeWeight(3 * s);
  p.beginShape();
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    const mt = 1 - t;
    const px = (mt * mt * -13 + t * t * 13) * s;
    const py = (mt * mt * 30 + 2 * mt * t * 42 + t * t * 30) * s;
    p.vertex(px, py);
  }
  p.endShape();

  p.pop();
}

export type DummyScene3DParams = {
  /** Maps universal joint names into canvas-pixel space. */
  at: JointAccessor;
  /** Uniform scale: universal-box pixels → canvas pixels (matches the blob figure radii). */
  s: number;
  /** Canvas pixel dimensions (WEBGL origin is centered; we shift to top-left coords). */
  width: number;
  height: number;
  /** Optional grab state — closed hands are drawn as a red sphere over the wrist. */
  handClosed?: HandClosed;
  /** Face expression. Defaults to "happy". */
  faceMode?: FaceMode;
  /** Draw happy eyes as closed horizontal lines (blink). */
  eyesClosed?: boolean;
};

/**
 * Render the blob dummy in 3D: shaded, pill-shaped limbs built from cylinders + spheres
 * with directional lighting. The joint layout/radii mirror the shared 2D blob figure so
 * the dummy nests into the carved hole identically on every screen. Caller supplies the
 * coordinate mapping (`at`) and scale (`s`); this paints one frame into the p5 canvas.
 */
export function drawDummyScene3D(p: p5, params: DummyScene3DParams) {
  const { at, s, width, height, handClosed, faceMode = "happy", eyesClosed = false } = params;

  // Bail on a degenerate scale/canvas so we never feed NaN geometry to WebGL (which can
  // freeze the canvas on the last frame). The next frame redraws cleanly.
  if (!(s > 0) || !Number.isFinite(width) || !Number.isFinite(height)) {
    return;
  }

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

  p.push();
  // WEBGL origin is the canvas center; shift so we can use top-left screen coordinates.
  p.translate(-width / 2, -height / 2, 0);
  p.noStroke();
  // Strong ambient + soft directional so the dummy reads as 3D without harsh shadows.
  p.ambientLight(170);
  p.directionalLight(105, 115, 135, 0.4, 0.55, -0.7);
  p.fill(BLOB_COLOR);

  // Legs + feet.
  capsule3D(p, hips, leftKnee, 19 * s);
  capsule3D(p, leftKnee, leftAnkle, 17 * s);
  capsule3D(p, hips, rightKnee, 19 * s);
  capsule3D(p, rightKnee, rightAnkle, 17 * s);
  foot3D(p, leftAnkle, 19 * s, 12 * s);
  foot3D(p, rightAnkle, 19 * s, 12 * s);

  // Arms + hands.
  capsule3D(p, leftShoulder, leftElbow, 14 * s);
  capsule3D(p, leftElbow, leftWrist, 13 * s);
  capsule3D(p, rightShoulder, rightElbow, 14 * s);
  capsule3D(p, rightElbow, rightWrist, 13 * s);
  sphere3D(p, leftWrist, 15 * s);
  sphere3D(p, rightWrist, 15 * s);

  // Torso.
  capsule3D(p, leftShoulder, rightShoulder, 22 * s);
  capsule3D(p, neck, hips, 25 * s);
  sphere3D(p, neck, 24 * s);
  sphere3D(p, hips, 27 * s);

  // Neck link + head.
  capsule3D(p, head, neck, 14 * s);
  const headCenter = head ?? neck;
  if (okPoint(headCenter)) {
    p.push();
    p.translate(headCenter.x, headCenter.y, 0);
    p.ellipsoid(50 * s, 58 * s, 50 * s);
    p.pop();
  }

  // Grabbing hands turn red.
  if (handClosed) {
    p.fill(HAND_GRAB_COLOR);
    if (handClosed.left) {
      sphere3D(p, leftWrist, 17 * s);
    }
    if (handClosed.right) {
      sphere3D(p, rightWrist, 17 * s);
    }
  }

  // Face on the front of the head (matches the saboteur's 2D expressions).
  if (okPoint(headCenter)) {
    drawFace3D(p, headCenter, s, faceMode, eyesClosed);
  }

  p.pop();
}
