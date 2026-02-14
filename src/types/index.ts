export interface Box {
  id: string;
  position: { x: number; y: number; z: number };  // meters
  dimensions: { width: number; height: number; depth: number };  // meters
  rotation: number;  // Y-axis only, radians
  materialId: string;
  label?: string;
}

export type UnitType = 'board_feet' | 'square_feet' | 'cubic_feet' | 'linear_feet' | 'count';

export interface Material {
  id: string;
  name: string;
  unitType: UnitType;
  color: string;
}

export type UnitSystem = 'imperial' | 'metric';

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
