import { Euler, Quaternion, Vector3 } from 'three';
import { BetaMiterCut, BetaMiterEdge, CutFace } from '../types';

type Axis = 'x' | 'y' | 'z';

type EdgeConfig = {
  axis: Axis;
  x?: -1 | 1;
  y?: -1 | 1;
  z?: -1 | 1;
};

const EDGE_CONFIG: Record<BetaMiterEdge, EdgeConfig> = {
  'top-front': { axis: 'x', y: 1, z: 1 },
  'top-back': { axis: 'x', y: 1, z: -1 },
  'bottom-front': { axis: 'x', y: -1, z: 1 },
  'bottom-back': { axis: 'x', y: -1, z: -1 },
  'top-left': { axis: 'z', x: -1, y: 1 },
  'top-right': { axis: 'z', x: 1, y: 1 },
  'bottom-left': { axis: 'z', x: -1, y: -1 },
  'bottom-right': { axis: 'z', x: 1, y: -1 },
  'front-left': { axis: 'y', x: -1, z: 1 },
  'front-right': { axis: 'y', x: 1, z: 1 },
  'back-left': { axis: 'y', x: -1, z: -1 },
  'back-right': { axis: 'y', x: 1, z: -1 },
};

const FACE_NORMAL: Record<CutFace, Vector3> = {
  left: new Vector3(-1, 0, 0),
  right: new Vector3(1, 0, 0),
  bottom: new Vector3(0, -1, 0),
  top: new Vector3(0, 1, 0),
  back: new Vector3(0, 0, -1),
  front: new Vector3(0, 0, 1),
};

const FACE_TO_EDGES: Record<CutFace, BetaMiterEdge[]> = {
  left: ['top-left', 'bottom-left', 'front-left', 'back-left'],
  right: ['top-right', 'bottom-right', 'front-right', 'back-right'],
  top: ['top-front', 'top-back', 'top-left', 'top-right'],
  bottom: ['bottom-front', 'bottom-back', 'bottom-left', 'bottom-right'],
  front: ['top-front', 'bottom-front', 'front-left', 'front-right'],
  back: ['top-back', 'bottom-back', 'back-left', 'back-right'],
};

export const BETA_MITER_EDGE_LABELS: Record<BetaMiterEdge, string> = {
  'top-front': 'Top + Front',
  'top-back': 'Top + Back',
  'top-left': 'Top + Left',
  'top-right': 'Top + Right',
  'bottom-front': 'Bottom + Front',
  'bottom-back': 'Bottom + Back',
  'bottom-left': 'Bottom + Left',
  'bottom-right': 'Bottom + Right',
  'front-left': 'Front + Left',
  'front-right': 'Front + Right',
  'back-left': 'Back + Left',
  'back-right': 'Back + Right',
};

function axisVector(axis: Axis): Vector3 {
  if (axis === 'x') return new Vector3(1, 0, 0);
  if (axis === 'y') return new Vector3(0, 1, 0);
  return new Vector3(0, 0, 1);
}

function getEdgePivot(
  edge: BetaMiterEdge,
  dims: { width: number; height: number; depth: number },
): Vector3 {
  const config = EDGE_CONFIG[edge];
  const halfW = dims.width / 2;
  const halfH = dims.height / 2;
  const halfD = dims.depth / 2;
  return new Vector3(
    (config.x ?? 0) * halfW,
    (config.y ?? 0) * halfH,
    (config.z ?? 0) * halfD,
  );
}

function getFaceCenter(face: CutFace, dims: { width: number; height: number; depth: number }): Vector3 {
  const halfW = dims.width / 2;
  const halfH = dims.height / 2;
  const halfD = dims.depth / 2;
  if (face === 'left') return new Vector3(-halfW, 0, 0);
  if (face === 'right') return new Vector3(halfW, 0, 0);
  if (face === 'bottom') return new Vector3(0, -halfH, 0);
  if (face === 'top') return new Vector3(0, halfH, 0);
  if (face === 'back') return new Vector3(0, 0, -halfD);
  return new Vector3(0, 0, halfD);
}

function pointInsideRotatedCube(
  point: Vector3,
  center: Vector3,
  rotation: Quaternion,
  size: number,
): boolean {
  const local = point.clone().sub(center).applyQuaternion(rotation.clone().invert());
  const half = size / 2 + 1e-6;
  return Math.abs(local.x) <= half && Math.abs(local.y) <= half && Math.abs(local.z) <= half;
}

export function buildBetaMiterCutterProps(
  dims: { width: number; height: number; depth: number },
  cut: BetaMiterCut,
) {
  const edgeConfig = EDGE_CONFIG[cut.edge];
  const edgeDir = axisVector(edgeConfig.axis);
  const faceNormal = FACE_NORMAL[cut.entryFace].clone();
  const pivot = getEdgePivot(cut.edge, dims);
  const faceCenter = getFaceCenter(cut.entryFace, dims);
  const cutterSize = Math.max(dims.width, dims.height, dims.depth) * 3;
  const outsideVector = faceNormal.clone().multiplyScalar(cutterSize / 2);
  const angleRad = (cut.angle * Math.PI) / 180;

  const inward = faceNormal.clone().multiplyScalar(-1);
  const towardCenter = faceCenter.clone().sub(pivot);
  const sweepDir = towardCenter
    .sub(edgeDir.clone().multiplyScalar(towardCenter.dot(edgeDir)))
    .sub(faceNormal.clone().multiplyScalar(towardCenter.dot(faceNormal)))
    .normalize();
  const sweep = sweepDir.lengthSq() > 0.5 ? sweepDir : new Vector3(1, 0, 0);
  const samplePoint = pivot.clone().addScaledVector(sweep, 0.06).addScaledVector(inward, 0.002);

  const plusRotation = new Quaternion().setFromAxisAngle(edgeDir, angleRad);
  const minusRotation = new Quaternion().setFromAxisAngle(edgeDir, -angleRad);
  const plusCenter = outsideVector.clone().applyQuaternion(plusRotation).add(pivot);
  const minusCenter = outsideVector.clone().applyQuaternion(minusRotation).add(pivot);
  const plusHitsInterior = pointInsideRotatedCube(samplePoint, plusCenter, plusRotation, cutterSize);
  const minusHitsInterior = pointInsideRotatedCube(samplePoint, minusCenter, minusRotation, cutterSize);

  const finalRotation =
    plusHitsInterior || !minusHitsInterior
      ? plusRotation
      : minusRotation;
  const finalCenter = outsideVector.clone().applyQuaternion(finalRotation).add(pivot);
  const euler = new Euler().setFromQuaternion(finalRotation, 'XYZ');

  return {
    position: [finalCenter.x, finalCenter.y, finalCenter.z] as [number, number, number],
    rotation: [euler.x, euler.y, euler.z] as [number, number, number],
    scale: [cutterSize, cutterSize, cutterSize] as [number, number, number],
  };
}

export function faceFromNormal(normal: { x: number; y: number; z: number }): CutFace | null {
  const ax = Math.abs(normal.x);
  const ay = Math.abs(normal.y);
  const az = Math.abs(normal.z);
  if (ax > ay && ax > az) return normal.x > 0 ? 'right' : 'left';
  if (ay > ax && ay > az) return normal.y > 0 ? 'top' : 'bottom';
  if (az > ax && az > ay) return normal.z > 0 ? 'front' : 'back';
  return null;
}

export function nearestMiterEdgeFromFacePoint(
  face: CutFace,
  centeredPoint: { x: number; y: number; z: number },
  dims: { width: number; height: number; depth: number },
): BetaMiterEdge {
  const point = new Vector3(centeredPoint.x, centeredPoint.y, centeredPoint.z);
  const edges = FACE_TO_EDGES[face];
  let best = edges[0];
  let bestDist = Infinity;
  for (const edge of edges) {
    const cfg = EDGE_CONFIG[edge];
    const linePoint = getEdgePivot(edge, dims);
    const lineDir = axisVector(cfg.axis);
    const dist = point.clone().sub(linePoint).cross(lineDir).length();
    if (dist < bestDist) {
      best = edge;
      bestDist = dist;
    }
  }
  return best;
}

export function getBetaMiterEdgeLine(
  edge: BetaMiterEdge,
  dims: { width: number; height: number; depth: number },
) {
  const cfg = EDGE_CONFIG[edge];
  const halfW = dims.width / 2;
  const halfH = dims.height / 2;
  const halfD = dims.depth / 2;

  if (cfg.axis === 'x') {
    const y = (cfg.y ?? 0) * halfH;
    const z = (cfg.z ?? 0) * halfD;
    return {
      start: [-halfW, y, z] as [number, number, number],
      end: [halfW, y, z] as [number, number, number],
    };
  }

  if (cfg.axis === 'y') {
    const x = (cfg.x ?? 0) * halfW;
    const z = (cfg.z ?? 0) * halfD;
    return {
      start: [x, -halfH, z] as [number, number, number],
      end: [x, halfH, z] as [number, number, number],
    };
  }

  const x = (cfg.x ?? 0) * halfW;
  const y = (cfg.y ?? 0) * halfH;
  return {
    start: [x, y, -halfD] as [number, number, number],
    end: [x, y, halfD] as [number, number, number],
  };
}
