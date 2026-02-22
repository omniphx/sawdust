import { Material } from '../types';

// Helper: inches to meters
const IN = 0.0254;
// Helper: feet to meters
const FT = 0.3048;

export const DEFAULT_MATERIALS: Material[] = [
  {
    id: '2x4-lumber',
    name: '2×4 Lumber',
    unitType: 'board_feet',
    color: '#E8C9A0',
    defaultDimensions: { width: 1.5 * IN, height: 3.5 * IN, depth: 8 * FT },
  },
  {
    id: '2x6-lumber',
    name: '2×6 Lumber',
    unitType: 'board_feet',
    color: '#DEBB9B',
    defaultDimensions: { width: 1.5 * IN, height: 5.5 * IN, depth: 8 * FT },
  },
  {
    id: '4x4-post',
    name: '4×4 Post',
    unitType: 'board_feet',
    color: '#D4AD8C',
    defaultDimensions: { width: 3.5 * IN, height: 3.5 * IN, depth: 8 * FT },
  },
  {
    id: 'plywood-3-4',
    name: 'Plywood 3/4"',
    unitType: 'square_feet',
    color: '#C9A96E',
    defaultDimensions: { width: 4 * FT, height: 0.75 * IN, depth: 8 * FT },
  },
  {
    id: 'plywood-1-2',
    name: 'Plywood 1/2"',
    unitType: 'square_feet',
    color: '#D4B07A',
    defaultDimensions: { width: 4 * FT, height: 0.5 * IN, depth: 8 * FT },
  },
  {
    id: 'cedar-boards',
    name: 'Cedar Boards',
    unitType: 'square_feet',
    color: '#E0B88A',
    defaultDimensions: { width: 0.75 * IN, height: 5.5 * IN, depth: 8 * FT },
  },
  {
    id: 'concrete',
    name: 'Concrete',
    unitType: 'cubic_feet',
    color: '#C8C8C8',
    defaultDimensions: { width: 1 * FT, height: 1 * FT, depth: 1 * FT },
  },
  {
    id: 'insulation',
    name: 'Insulation',
    unitType: 'square_feet',
    color: '#F5E6C8',
    defaultDimensions: { width: 3.5 * IN, height: 15 * IN, depth: 93 * IN },
  },
  {
    id: 'trim',
    name: 'Trim',
    unitType: 'linear_feet',
    color: '#EDDCC8',
    defaultDimensions: { width: 0.75 * IN, height: 2.5 * IN, depth: 8 * FT },
  },
  {
    id: 'heater',
    name: 'Sauna Heater',
    unitType: 'count',
    color: '#7A7A7A',
    defaultDimensions: { width: 20 * IN, height: 20 * IN, depth: 20 * IN },
  },
];

// Helper: feet to meters (local to this file)
const _FT = 0.3048;
const _IN = 0.0254;

// Standard purchase sizes per material (in meters)
// For sheet goods, this represents the sheet dimensions (width × depth)
export const STANDARD_PURCHASE_SIZES: Record<string, number> = {
  '2x4-lumber': 8 * _FT,
  '2x6-lumber': 8 * _FT,
  '4x4-post': 8 * _FT,
  'plywood-3-4': 8 * _FT,   // 4'×8' sheet (depth = 8ft)
  'plywood-1-2': 8 * _FT,   // 4'×8' sheet (depth = 8ft)
  'cedar-boards': 8 * _FT,
  'insulation': 93 * _IN,    // 93" length
  'trim': 8 * _FT,
};

// Common purchase length options for dropdown (in meters), with labels
export const PURCHASE_LENGTH_OPTIONS = [
  { label: "6 ft", meters: 6 * _FT },
  { label: "8 ft", meters: 8 * _FT },
  { label: "10 ft", meters: 10 * _FT },
  { label: "12 ft", meters: 12 * _FT },
  { label: "16 ft", meters: 16 * _FT },
];

export function getMaterialById(id: string): Material | undefined {
  return DEFAULT_MATERIALS.find(m => m.id === id);
}

export function getMaterialColor(materialId: string): string {
  const material = getMaterialById(materialId);
  return material?.color ?? '#888888';
}
