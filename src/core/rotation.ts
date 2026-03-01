import { Euler, Quaternion, Vector3 } from 'three';

export interface Rotation3 {
  x: number;
  y: number;
  z: number;
}

export const ZERO_ROTATION: Rotation3 = { x: 0, y: 0, z: 0 };

/** Converts legacy single-number rotation (Y-axis) to 3D rotation object */
export function migrateRotation(r: number | Rotation3): Rotation3 {
  if (typeof r === 'number') {
    return { x: 0, y: r, z: 0 };
  }
  return r;
}

/** Rotates a point around a center on a given axis by an angle (radians) */
export function rotatePositionAroundAxis(
  pos: { x: number; y: number; z: number },
  center: { x: number; y: number; z: number },
  axis: 'x' | 'y' | 'z',
  angle: number,
): { x: number; y: number; z: number } {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  if (axis === 'y') {
    // Rotate around Y axis (XZ plane)
    // Y rotation matrix: [cos, 0, sin; 0, 1, 0; -sin, 0, cos]
    const dx = pos.x - center.x;
    const dz = pos.z - center.z;
    return {
      x: center.x + dx * cos + dz * sin,
      y: pos.y,
      z: center.z - dx * sin + dz * cos,
    };
  } else if (axis === 'x') {
    // Rotate around X axis (YZ plane)
    const dy = pos.y - center.y;
    const dz = pos.z - center.z;
    return {
      x: pos.x,
      y: center.y + dy * cos - dz * sin,
      z: center.z + dy * sin + dz * cos,
    };
  } else {
    // Rotate around Z axis (XY plane)
    const dx = pos.x - center.x;
    const dy = pos.y - center.y;
    return {
      x: center.x + dx * cos - dy * sin,
      y: center.y + dx * sin + dy * cos,
      z: pos.z,
    };
  }
}

/**
 * Applies an incremental world-axis rotation to an existing Euler rotation.
 * Uses quaternion composition to preserve rigid-body behavior for grouped items.
 */
export function addRotationOnAxis(
  rotation: Rotation3,
  axis: 'x' | 'y' | 'z',
  angle: number,
): Rotation3 {
  const currentEuler = new Euler(rotation.x, rotation.y, rotation.z, 'XYZ');
  const currentQuat = new Quaternion().setFromEuler(currentEuler);

  const axisVector =
    axis === 'x'
      ? new Vector3(1, 0, 0)
      : axis === 'y'
        ? new Vector3(0, 1, 0)
        : new Vector3(0, 0, 1);
  const deltaQuat = new Quaternion().setFromAxisAngle(axisVector, angle);

  // Pre-multiply so the delta is applied in world space.
  const nextQuat = deltaQuat.multiply(currentQuat);
  const nextEuler = new Euler().setFromQuaternion(nextQuat, 'XYZ');
  return { x: nextEuler.x, y: nextEuler.y, z: nextEuler.z };
}

/**
 * Applies an Euler rotation (XYZ order) to a vector.
 * Three.js 'XYZ' Euler computes R = Rx * Ry * Rz, so when applied to
 * a vector: R * v = Rx(Ry(Rz(v))). We must apply Z first, then Y, then X.
 */
export function applyEulerToVec(
  v: { x: number; y: number; z: number },
  rot: Rotation3,
): { x: number; y: number; z: number } {
  let { x, y, z } = v;

  // 1. Rotate around Z first
  if (rot.z !== 0) {
    const cos = Math.cos(rot.z), sin = Math.sin(rot.z);
    const nx = x * cos - y * sin;
    const ny = x * sin + y * cos;
    x = nx; y = ny;
  }

  // 2. Then rotate around Y
  if (rot.y !== 0) {
    const cos = Math.cos(rot.y), sin = Math.sin(rot.y);
    const nx = x * cos + z * sin;
    const nz = -x * sin + z * cos;
    x = nx; z = nz;
  }

  // 3. Then rotate around X
  if (rot.x !== 0) {
    const cos = Math.cos(rot.x), sin = Math.sin(rot.x);
    const ny = y * cos - z * sin;
    const nz = y * sin + z * cos;
    y = ny; z = nz;
  }

  return { x, y, z };
}

/**
 * Computes the visual center of a box given its corner position, dimensions, and rotation.
 * The visual center = corner + applyEuler(halfDims, rotation)
 */
export function boxVisualCenter(
  position: { x: number; y: number; z: number },
  dimensions: { width: number; height: number; depth: number },
  rotation: Rotation3,
): { x: number; y: number; z: number } {
  const halfDims = {
    x: dimensions.width / 2,
    y: dimensions.height / 2,
    z: dimensions.depth / 2,
  };
  const rotated = applyEulerToVec(halfDims, rotation);
  return {
    x: position.x + rotated.x,
    y: position.y + rotated.y,
    z: position.z + rotated.z,
  };
}

/**
 * Back-computes the corner position from a visual center, dimensions, and rotation.
 * corner = visualCenter - applyEuler(halfDims, rotation)
 */
export function cornerFromVisualCenter(
  visualCenter: { x: number; y: number; z: number },
  dimensions: { width: number; height: number; depth: number },
  rotation: Rotation3,
): { x: number; y: number; z: number } {
  const halfDims = {
    x: dimensions.width / 2,
    y: dimensions.height / 2,
    z: dimensions.depth / 2,
  };
  const rotated = applyEulerToVec(halfDims, rotation);
  return {
    x: visualCenter.x - rotated.x,
    y: visualCenter.y - rotated.y,
    z: visualCenter.z - rotated.z,
  };
}
