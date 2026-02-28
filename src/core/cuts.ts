import { BoxCut, CutFace } from '../types';

interface CutterProps {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}


/**
 * Face configuration: for each face, defines the normal axis, the pivot axis
 * the cut rotates around, and the direction the cutter is offset.
 *
 * The cutter is a box that gets positioned at the face, then rotated by the
 * cut angle around the appropriate edge axis. When subtracted via CSG, this produces
 * the desired wedge cut.
 *
 * Coordinate system: box centered at origin with dimensions (w, h, d).
 * - top/bottom: normal along Y, pivot around X (cuts across width)
 * - front/back: normal along Z, pivot around X (cuts across width)
 * - left/right: normal along X, pivot around Y (miter cut — diagonal across depth when viewed from above)
 */
interface FaceConfig {
  // Which axis is the face normal
  normalAxis: 'x' | 'y' | 'z';
  // Direction along the normal axis (+1 or -1) toward the face
  normalDir: 1 | -1;
  // Which axis the cut pivots around
  pivotAxis: 'x' | 'y' | 'z';
  // Sign for the rotation angle
  rotationSign: 1 | -1;
}

const FACE_CONFIG: Record<CutFace, FaceConfig> = {
  top:    { normalAxis: 'y', normalDir:  1, pivotAxis: 'x', rotationSign:  1 },
  bottom: { normalAxis: 'y', normalDir: -1, pivotAxis: 'x', rotationSign: -1 },
  front:  { normalAxis: 'z', normalDir:  1, pivotAxis: 'x', rotationSign: -1 },
  back:   { normalAxis: 'z', normalDir: -1, pivotAxis: 'x', rotationSign:  1 },
  right:  { normalAxis: 'x', normalDir:  1, pivotAxis: 'y', rotationSign: -1 },
  left:   { normalAxis: 'x', normalDir: -1, pivotAxis: 'y', rotationSign:  1 },
};

/**
 * Rotates a 3D vector around the given axis by angle (radians).
 * Uses Three.js rotation convention (right-handed, intrinsic).
 */
function rotateVec3(
  v: [number, number, number],
  axis: 'x' | 'y' | 'z',
  angle: number,
): [number, number, number] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const [x, y, z] = v;
  if (axis === 'x') return [x, y * cos - z * sin, y * sin + z * cos];
  if (axis === 'y') return [x * cos + z * sin, y, -x * sin + z * cos];
  return [x * cos - y * sin, x * sin + y * cos, z];
}

/**
 * Given a box's dimensions and a cut definition, returns the position,
 * rotation, and scale for a cutter box that, when subtracted via CSG,
 * produces the correct angled cut.
 *
 * The cutter pivots around the face edge of the box (not its own center),
 * so the cut plane always starts exactly at the selected face regardless
 * of angle.
 *
 * All coordinates are relative to the box center (how CSG geometry is centered).
 */
export function buildCutterProps(
  dimensions: { width: number; height: number; depth: number },
  cut: BoxCut,
): CutterProps {
  const { width: w, height: h, depth: d } = dimensions;
  const config = FACE_CONFIG[cut.face];
  const angleRad = (cut.angle * Math.PI) / 180;
  const rotationAngle = config.rotationSign * angleRad;

  // Half-dimensions along each axis
  const halfDim: Record<string, number> = { x: w / 2, y: h / 2, z: d / 2 };

  // The cutter box size — oversized so it fully covers the cut region
  const cutterSize = Math.max(w, h, d) * 3;

  const axisIndex = { x: 0, y: 1, z: 2 }[config.normalAxis] as 0 | 1 | 2;

  // Pivot point = center of the box face
  const pivot: [number, number, number] = [0, 0, 0];
  pivot[axisIndex] = config.normalDir * halfDim[config.normalAxis];

  // For partial-depth cuts, shift pivot inward from the face
  if (cut.depth !== undefined) {
    const fullDim = dimensions[
      config.normalAxis === 'x' ? 'width' : config.normalAxis === 'y' ? 'height' : 'depth'
    ];
    const inset = fullDim - cut.depth;
    pivot[axisIndex] -= config.normalDir * inset;
  }

  // Cutter center starts directly outside the face (normalDir * cutterSize/2 from pivot)
  const relVec: [number, number, number] = [0, 0, 0];
  relVec[axisIndex] = config.normalDir * cutterSize / 2;

  // Rotate the relative vector around the pivot axis so the cutter pivots at the face edge
  const rotatedRelVec = rotateVec3(relVec, config.pivotAxis, rotationAngle);

  const pos: [number, number, number] = [
    pivot[0] + rotatedRelVec[0],
    pivot[1] + rotatedRelVec[1],
    pivot[2] + rotatedRelVec[2],
  ];

  const rot: [number, number, number] = [0, 0, 0];
  const pivotIndex = { x: 0, y: 1, z: 2 }[config.pivotAxis] as 0 | 1 | 2;
  rot[pivotIndex] = rotationAngle;

  return {
    position: pos,
    rotation: rot,
    scale: [cutterSize, cutterSize, cutterSize],
  };
}
