import { Material } from '../types';

export const DEFAULT_MATERIALS: Material[] = [
  {
    id: '2x4-lumber',
    name: '2×4 Lumber',
    unitType: 'board_feet',
    color: '#D4A574',
  },
  {
    id: '2x6-lumber',
    name: '2×6 Lumber',
    unitType: 'board_feet',
    color: '#C9956C',
  },
  {
    id: '4x4-post',
    name: '4×4 Post',
    unitType: 'board_feet',
    color: '#B8865C',
  },
  {
    id: 'plywood-3-4',
    name: 'Plywood 3/4"',
    unitType: 'square_feet',
    color: '#E8D4B8',
  },
  {
    id: 'plywood-1-2',
    name: 'Plywood 1/2"',
    unitType: 'square_feet',
    color: '#F0E0C8',
  },
  {
    id: 'cedar-boards',
    name: 'Cedar Boards',
    unitType: 'square_feet',
    color: '#CD853F',
  },
  {
    id: 'concrete',
    name: 'Concrete',
    unitType: 'cubic_feet',
    color: '#A0A0A0',
  },
  {
    id: 'insulation',
    name: 'Insulation',
    unitType: 'square_feet',
    color: '#FFE4B5',
  },
  {
    id: 'trim',
    name: 'Trim',
    unitType: 'linear_feet',
    color: '#DEB887',
  },
  {
    id: 'heater',
    name: 'Sauna Heater',
    unitType: 'count',
    color: '#2F2F2F',
  },
];

export function getMaterialById(id: string): Material | undefined {
  return DEFAULT_MATERIALS.find(m => m.id === id);
}

export function getMaterialColor(materialId: string): string {
  const material = getMaterialById(materialId);
  return material?.color ?? '#888888';
}
