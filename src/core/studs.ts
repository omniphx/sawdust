import { v4 as uuid } from 'uuid';
import { Box } from '../types';
import { WallTargetFace, WallOpening, HeaderStyle } from '../types/wall';

// Standard lumber dimensions (actual, in meters)
const IN = 0.0254;
const PLATE_H = 1.5 * IN;   // 1.5" actual height of a plate
const STUD_W = 1.5 * IN;    // 1.5" actual width of a stud

// Header board heights by style
const HEADER_BOARD_H: Record<HeaderStyle, number> = {
  'built-up':      5.5 * IN,  // 2×6 used for built-up
  'single-2x6':    5.5 * IN,
  'single-2x8':    7.25 * IN,
  'single-2x10':   9.25 * IN,
};

// Total header height by style
function getHeaderHeight(style: HeaderStyle): number {
  if (style === 'built-up') {
    // Two 2×6 boards + 0.5" plywood spacer
    return 2 * HEADER_BOARD_H['built-up'] + 0.5 * IN;
  }
  return HEADER_BOARD_H[style];
}

// Make a box with given local-space coords, then transform based on faceAxis
function makeBox(
  x: number, y: number, z: number,
  width: number, height: number, depth: number,
  materialId: string,
  groupId: string,
  label: string,
  faceAxis: 'x' | 'z',
  wallStartX: number,
  wallStartZ: number,
  wallY: number,
): Box {
  // Local space: wall runs +X, thickness runs +Z, height runs +Y
  // wallStartX/wallStartZ are the world-space origin of the local X=0,Z=0 corner

  let worldX: number, worldY: number, worldZ: number;
  let worldWidth: number, worldHeight: number, worldDepth: number;

  if (faceAxis === 'x') {
    // Wall runs along world X, thickness along world Z
    worldX = wallStartX + x;
    worldY = wallY + y;
    worldZ = wallStartZ + z;
    worldWidth = width;
    worldHeight = height;
    worldDepth = depth;
  } else {
    // Wall runs along world Z, thickness along world X
    // Swap: local X → world Z, local Z → world X, local width ↔ local depth
    worldX = wallStartX + z;
    worldY = wallY + y;
    worldZ = wallStartZ + x;
    worldWidth = depth;
    worldHeight = height;
    worldDepth = width;
  }

  return {
    id: uuid(),
    position: { x: worldX, y: worldY, z: worldZ },
    dimensions: { width: worldWidth, height: worldHeight, depth: worldDepth },
    rotation: { x: 0, y: 0, z: 0 },
    materialId,
    label,
    groupId,
  };
}

export function generateStudWall(
  target: WallTargetFace,
  studMaterialId: string,
  plateMaterialId: string,
  studSpacing: number,
  doubleTopPlate: boolean,
  openings: WallOpening[],
  groupId: string,
): Box[] {
  const {
    faceAxis,
    wallStartX,
    wallStartZ,
    wallY,
    wallLength,
    wallHeight,
    wallDepth,
  } = target;

  const boxes: Box[] = [];

  const mk = (
    x: number, y: number, z: number,
    w: number, h: number, d: number,
    matId: string,
    label: string,
  ) => makeBox(x, y, z, w, h, d, matId, groupId, label, faceAxis, wallStartX, wallStartZ, wallY);

  // Interior stud height (between top of bottom plate and bottom of top plate)
  const numTopPlates = doubleTopPlate ? 2 : 1;
  const interiorH = wallHeight - PLATE_H * (numTopPlates + 1);

  // ── Bottom plate ──────────────────────────────────────────────────────────
  boxes.push(mk(0, 0, 0, wallLength, PLATE_H, wallDepth, plateMaterialId, 'Bottom Plate'));

  // ── Top plate(s) ──────────────────────────────────────────────────────────
  if (doubleTopPlate) {
    boxes.push(mk(0, wallHeight - 2 * PLATE_H, 0, wallLength, PLATE_H, wallDepth, plateMaterialId, 'Top Plate (lower)'));
    boxes.push(mk(0, wallHeight - PLATE_H, 0, wallLength, PLATE_H, wallDepth, plateMaterialId, 'Top Plate (upper)'));
  } else {
    boxes.push(mk(0, wallHeight - PLATE_H, 0, wallLength, PLATE_H, wallDepth, plateMaterialId, 'Top Plate'));
  }

  // Precompute opening zone boundaries for stud skipping
  // Each opening occupies [position - STUD_W, position + width + STUD_W] (king stud outer edges)
  const openingZones = openings.map((o) => ({
    left: o.position - STUD_W,
    right: o.position + o.width + STUD_W,
  }));

  // ── Openings: king studs, jack studs, headers, cripples, sills ─────────
  for (const opening of openings) {
    const { position: p, width: ow, height: oh, sillHeight: sh, headerStyle, type } = opening;
    const headerH = getHeaderHeight(headerStyle);

    // King studs (full interior height, flanking the opening)
    boxes.push(mk(p - STUD_W, PLATE_H, 0, STUD_W, interiorH, wallDepth, studMaterialId, 'King Stud'));
    boxes.push(mk(p + ow, PLATE_H, 0, STUD_W, interiorH, wallDepth, studMaterialId, 'King Stud'));

    // Jack studs (trimmers) — from plate to rough opening height
    const jackH = oh - PLATE_H;
    if (jackH > 0) {
      boxes.push(mk(p, PLATE_H, 0, STUD_W, jackH, wallDepth, studMaterialId, 'Jack Stud'));
      boxes.push(mk(p + ow - STUD_W, PLATE_H, 0, STUD_W, jackH, wallDepth, studMaterialId, 'Jack Stud'));
    }

    // ── Header ──────────────────────────────────────────────────────────────
    const headerY = oh; // top of rough opening = bottom of header
    if (headerStyle === 'built-up') {
      const boardH = HEADER_BOARD_H['built-up'];
      const plyD = 0.5 * IN;
      const boardD = STUD_W; // 1.5" each side
      // Front lumber
      boxes.push(mk(p, headerY, 0, ow, boardH, boardD, studMaterialId, 'Header (front)'));
      // Plywood spacer
      boxes.push(mk(p, headerY, boardD, ow, boardH + 0.5 * IN, plyD, 'plywood-1-2', 'Header Spacer'));
      // Back lumber
      boxes.push(mk(p, headerY, boardD + plyD, ow, boardH, boardD, studMaterialId, 'Header (back)'));
    } else {
      const boardH = HEADER_BOARD_H[headerStyle];
      boxes.push(mk(p, headerY, 0, ow, boardH, wallDepth, studMaterialId, 'Header'));
    }

    // ── Cripple studs above header ───────────────────────────────────────
    const crippleTopY = PLATE_H + interiorH; // bottom of first top plate
    const crippleAboveBot = headerY + headerH;
    const crippleAboveH = crippleTopY - crippleAboveBot;
    if (crippleAboveH > 0.001) {
      // Iterate stud positions within opening width (excluding jack positions)
      let cx = p + studSpacing;
      while (cx + STUD_W <= p + ow - STUD_W) {
        boxes.push(mk(cx, crippleAboveBot, 0, STUD_W, crippleAboveH, wallDepth, studMaterialId, 'Cripple Stud'));
        cx += studSpacing;
      }
    }

    // ── Window: rough sill + cripples below ──────────────────────────────
    if (type === 'window' && sh !== undefined && sh > 0) {
      const sillY = PLATE_H + sh;
      // Rough sill
      boxes.push(mk(p, sillY, 0, ow, PLATE_H, wallDepth, plateMaterialId, 'Rough Sill'));

      // Cripple studs below sill
      const crippleBelowH = sh;
      if (crippleBelowH > 0.001) {
        let cx = p + studSpacing;
        while (cx + STUD_W <= p + ow - STUD_W) {
          boxes.push(mk(cx, PLATE_H, 0, STUD_W, crippleBelowH, wallDepth, studMaterialId, 'Cripple Stud'));
          cx += studSpacing;
        }
      }
    }
  }

  // ── Continuous studs ──────────────────────────────────────────────────────
  // Stud layout: first stud at x=0 (left end stud), then at studSpacing intervals
  // Skip studs that fall inside an opening zone
  let x = 0;
  while (x <= wallLength) {
    const inZone = openingZones.some((z) => x >= z.left - 0.001 && x < z.right - 0.001);
    if (!inZone) {
      // Stud fits if its right edge doesn't exceed wall length
      const studRight = x + STUD_W;
      if (studRight <= wallLength + 0.001) {
        boxes.push(mk(x, PLATE_H, 0, STUD_W, interiorH, wallDepth, studMaterialId, 'Stud'));
      }
    }
    if (x === 0) {
      x = studSpacing;
    } else {
      x += studSpacing;
    }
  }

  return boxes;
}
