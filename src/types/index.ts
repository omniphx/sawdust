export type CutFace = 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right';

/** The adjacent face whose shared edge the blade enters from. */
export type CutEdge = 'top' | 'bottom' | 'front' | 'back';
export type BetaMiterEdge =
  | 'top-front'
  | 'top-back'
  | 'top-left'
  | 'top-right'
  | 'bottom-front'
  | 'bottom-back'
  | 'bottom-left'
  | 'bottom-right'
  | 'front-left'
  | 'front-right'
  | 'back-left'
  | 'back-right';

export interface BetaMiterCut {
  id: string;
  edge: BetaMiterEdge;
  entryFace: CutFace;
  angle: number;
}

export interface BetaMiterDraft {
  boxId: string;
  edge: BetaMiterEdge;
  entryFace: CutFace;
  angle: number;
}

export type { WallOpening, WallTargetFace, HeaderStyle } from './wall';

export interface BoxCut {
  id: string;
  face: CutFace;    // Which face the cut starts from
  angle: number;    // Degrees (0 = square shoulder, 45 = miter). Range: 0–89
  edge?: CutEdge;   // Adjacent face the blade enters from. Omit = default edge per face.
  depth?: number;   // Meters from the face. Omit = full through-cut
}

export interface Box {
  id: string;
  position: { x: number; y: number; z: number };  // meters, bottom-left-front corner
  dimensions: { width: number; height: number; depth: number };  // meters
  rotation: { x: number; y: number; z: number };  // Euler angles (radians, XYZ order)
  materialId: string;
  label?: string;
  groupId?: string;
  locked?: boolean;
  hidden?: boolean;
  cuts?: BoxCut[];
  betaMiterCuts?: BetaMiterCut[];
}

export type UnitType = 'board_feet' | 'square_feet' | 'cubic_feet' | 'linear_feet' | 'count';

export interface Material {
  id: string;
  name: string;
  unitType: UnitType;
  color: string;
  defaultDimensions?: { width: number; height: number; depth: number }; // meters
}

export type UnitSystem = 'feet' | 'inches' | 'metric';

export interface Project {
  id: string;
  name: string;
  unitSystem: UnitSystem;
  boxes: Box[];
}

export interface BOMEntry {
  materialId: string;
  materialName: string;
  quantity: number;
  unit: string;
}

export interface PurchasePiece {
  boxId: string;
  boxLabel: string;
  pieceLength: number; // meters (longest dimension, or face dims for sheet goods)
  oversized: boolean;
}

export interface PurchaseEntry {
  materialId: string;
  materialName: string;
  color: string;
  boardsNeeded: number;
  standardSizeLabel: string;
  pieces: PurchasePiece[];
}

export interface ComponentTemplate {
  id: string;
  name: string;
  boxes: Box[];       // positions relative to origin
  createdAt: number;
}
