export interface Box {
  id: string;
  position: { x: number; y: number; z: number };  // meters, bottom-left-front corner
  dimensions: { width: number; height: number; depth: number };  // meters
  rotation: number;  // Y-axis only, radians
  materialId: string;
  label?: string;
  groupId?: string;
  locked?: boolean;
  hidden?: boolean;
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
