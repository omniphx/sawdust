import { Vector3, Camera } from 'three';
import type { Box } from '../types';
import type { CameraView } from '../components/viewport/Viewport';

/** Returns the 8 corner positions of a box in world space */
export function getBoxCorners(box: Box): Vector3[] {
  const { x, y, z } = box.position;
  const { width: w, height: h, depth: d } = box.dimensions;
  return [
    new Vector3(x, y, z),
    new Vector3(x + w, y, z),
    new Vector3(x, y + h, z),
    new Vector3(x + w, y + h, z),
    new Vector3(x, y, z + d),
    new Vector3(x + w, y, z + d),
    new Vector3(x, y + h, z + d),
    new Vector3(x + w, y + h, z + d),
  ];
}

/**
 * Find the nearest box corner within a screen-space pixel radius.
 * Returns the 3D world position of the nearest corner, or null if none is close enough.
 */
export function findNearestSnapPoint(
  worldPoint: Vector3,
  boxes: Box[],
  camera: Camera,
  containerWidth: number,
  containerHeight: number,
  snapRadiusPx: number = 12,
): Vector3 | null {
  // Project the reference point to screen space
  const refScreen = worldPoint.clone().project(camera);
  const refSx = ((refScreen.x + 1) / 2) * containerWidth;
  const refSy = ((-refScreen.y + 1) / 2) * containerHeight;

  let bestDist = Infinity;
  let bestCorner: Vector3 | null = null;

  for (const box of boxes) {
    if (box.hidden) continue;
    const corners = getBoxCorners(box);
    for (const corner of corners) {
      const projected = corner.clone().project(camera);
      const sx = ((projected.x + 1) / 2) * containerWidth;
      const sy = ((-projected.y + 1) / 2) * containerHeight;

      const dx = sx - refSx;
      const dy = sy - refSy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < snapRadiusPx && dist < bestDist) {
        bestDist = dist;
        bestCorner = corner;
      }
    }
  }

  return bestCorner;
}

/** Axes ignored per view when computing distance */
const IGNORED_AXIS: Record<CameraView, 'x' | 'y' | 'z' | null> = {
  iso: null,
  top: null,
  front: 'z',
  back: 'z',
  left: 'x',
  right: 'x',
  custom: null,
};

/**
 * Compute distance between two points, ignoring the axis that is
 * perpendicular to the current camera view.
 */
export function measureDistance(a: Vector3, b: Vector3, cameraView: CameraView): number {
  const ignored = IGNORED_AXIS[cameraView];
  const dx = ignored === 'x' ? 0 : a.x - b.x;
  const dy = ignored === 'y' ? 0 : a.y - b.y;
  const dz = ignored === 'z' ? 0 : a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
