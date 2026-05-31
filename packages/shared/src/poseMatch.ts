import { buildBlobFigure, HOLE_PADDING, type FigurePrimitive } from "./figure.js";
import type { UniversalPose } from "./types.js";

/**
 * Compares a live universal pose against a target pose and returns a 0-100 match %.
 *
 * This intentionally scores the thing the player sees: the percentage of the
 * rendered dummy body that fits inside the target hole silhouette. The live body
 * is sampled as the unpadded blob figure, while the hole is the same blob inflated
 * by HOLE_PADDING. A pose scores 100 when the whole visible model is inside the
 * cutout, even if its joint centers are not perfectly coincident with the target.
 *
 * @param sampleStep Universal-box pixels between coverage samples. Smaller is more
 *                   exact but costs more per frame.
 */
export function comparePoses(
  live: UniversalPose,
  target: UniversalPose,
  options: { sampleStep?: number; holePadding?: number } = {}
): number {
  if (live.joints.length === 0 || target.joints.length === 0) {
    return 0;
  }

  const sampleStep = finitePositive(options.sampleStep, 3);
  const holePadding = finiteNonNegative(options.holePadding, HOLE_PADDING);
  const liveBody = buildBlobFigure(live.joints);
  const targetHole = buildBlobFigure(target.joints, { pad: holePadding });
  const bounds = primitiveBounds(liveBody);

  if (!bounds) {
    return 0;
  }

  let bodySamples = 0;
  let containedSamples = 0;

  const startX = Math.floor(bounds.minX / sampleStep) * sampleStep + sampleStep / 2;
  const startY = Math.floor(bounds.minY / sampleStep) * sampleStep + sampleStep / 2;

  for (let y = startY; y <= bounds.maxY; y += sampleStep) {
    for (let x = startX; x <= bounds.maxX; x += sampleStep) {
      const point = { x, y };
      if (!liveBody.some((primitive) => containsPrimitive(point, primitive))) {
        continue;
      }

      bodySamples += 1;
      if (targetHole.some((primitive) => containsPrimitive(point, primitive))) {
        containedSamples += 1;
      }
    }
  }

  if (bodySamples === 0) {
    return 0;
  }

  return Math.round((containedSamples / bodySamples) * 100);
}

type Point = { x: number; y: number };
type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

function finitePositive(value: number | undefined, fallback: number) {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback;
}

function finiteNonNegative(value: number | undefined, fallback: number) {
  return value !== undefined && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function primitiveBounds(primitives: FigurePrimitive[]): Bounds | null {
  let bounds: Bounds | null = null;

  const include = (point: Point, pad = 0) => {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      return;
    }

    if (!bounds) {
      bounds = { minX: point.x - pad, minY: point.y - pad, maxX: point.x + pad, maxY: point.y + pad };
      return;
    }

    bounds.minX = Math.min(bounds.minX, point.x - pad);
    bounds.minY = Math.min(bounds.minY, point.y - pad);
    bounds.maxX = Math.max(bounds.maxX, point.x + pad);
    bounds.maxY = Math.max(bounds.maxY, point.y + pad);
  };

  for (const primitive of primitives) {
    switch (primitive.kind) {
      case "capsule": {
        const pad = primitive.width / 2;
        include(primitive.a, pad);
        include(primitive.b, pad);
        break;
      }
      case "circle":
        include(primitive.c, primitive.r);
        break;
      case "ellipse":
        include({ x: primitive.c.x - primitive.rx, y: primitive.c.y - primitive.ry });
        include({ x: primitive.c.x + primitive.rx, y: primitive.c.y + primitive.ry });
        break;
      case "polyline": {
        const pad = primitive.width / 2;
        primitive.points.forEach((point) => include(point, pad));
        break;
      }
      case "quad": {
        const pad = primitive.width / 2;
        include(primitive.from, pad);
        include(primitive.control, pad);
        include(primitive.to, pad);
        break;
      }
      default:
        break;
    }
  }

  return bounds;
}

function containsPrimitive(point: Point, primitive: FigurePrimitive): boolean {
  switch (primitive.kind) {
    case "capsule":
      return distanceToSegment(point, primitive.a, primitive.b) <= primitive.width / 2;
    case "circle":
      return Math.hypot(point.x - primitive.c.x, point.y - primitive.c.y) <= primitive.r;
    case "ellipse": {
      const dx = point.x - primitive.c.x;
      const dy = point.y - primitive.c.y;
      return (dx * dx) / (primitive.rx * primitive.rx) + (dy * dy) / (primitive.ry * primitive.ry) <= 1;
    }
    case "polyline":
      return primitive.points.some((from, index) => {
        const to = primitive.points[index + 1];
        return to ? distanceToSegment(point, from, to) <= primitive.width / 2 : false;
      });
    case "quad":
      return distanceToQuad(point, primitive) <= primitive.width / 2;
    default:
      return false;
  }
}

function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : clamp01(((point.x - a.x) * dx + (point.y - a.y) * dy) / lenSq);
  const closest = { x: a.x + dx * t, y: a.y + dy * t };
  return Math.hypot(point.x - closest.x, point.y - closest.y);
}

function distanceToQuad(point: Point, primitive: Extract<FigurePrimitive, { kind: "quad" }>): number {
  let previous = primitive.from;
  let distance = Infinity;

  for (let i = 1; i <= 12; i += 1) {
    const t = i / 12;
    const current = quadraticPoint(primitive.from, primitive.control, primitive.to, t);
    distance = Math.min(distance, distanceToSegment(point, previous, current));
    previous = current;
  }

  return distance;
}

function quadraticPoint(from: Point, control: Point, to: Point, t: number): Point {
  const mt = 1 - t;
  return {
    x: mt * mt * from.x + 2 * mt * t * control.x + t * t * to.x,
    y: mt * mt * from.y + 2 * mt * t * control.y + t * t * to.y
  };
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}
