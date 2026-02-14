import { Box, BOMEntry, UnitType } from '../types';
import { getMaterialById } from './materials';
import {
  calculateBoardFeet,
  squareMetersToFeet,
  cubicMetersToFeet,
  metersToLinearFeet,
} from './units';

function getUnitLabel(unitType: UnitType): string {
  switch (unitType) {
    case 'board_feet':
      return 'bd ft';
    case 'square_feet':
      return 'sq ft';
    case 'cubic_feet':
      return 'cu ft';
    case 'linear_feet':
      return 'lin ft';
    case 'count':
      return 'ea';
  }
}

function calculateQuantity(box: Box, unitType: UnitType): number {
  const { width, height, depth } = box.dimensions;

  switch (unitType) {
    case 'board_feet':
      return calculateBoardFeet(width, height, depth);

    case 'square_feet': {
      // Use the largest face area
      const faces = [
        width * height,
        width * depth,
        height * depth,
      ];
      const largestFace = Math.max(...faces);
      return squareMetersToFeet(largestFace);
    }

    case 'cubic_feet': {
      const volume = width * height * depth;
      return cubicMetersToFeet(volume);
    }

    case 'linear_feet': {
      const longestDimension = Math.max(width, height, depth);
      return metersToLinearFeet(longestDimension);
    }

    case 'count':
      return 1;
  }
}

export function calculateBOM(boxes: Box[]): BOMEntry[] {
  const bomMap = new Map<string, BOMEntry>();

  for (const box of boxes) {
    const material = getMaterialById(box.materialId);
    if (!material) continue;

    const quantity = calculateQuantity(box, material.unitType);
    const existing = bomMap.get(material.id);

    if (existing) {
      existing.quantity += quantity;
    } else {
      bomMap.set(material.id, {
        materialId: material.id,
        materialName: material.name,
        quantity,
        unit: getUnitLabel(material.unitType),
      });
    }
  }

  return Array.from(bomMap.values()).sort((a, b) =>
    a.materialName.localeCompare(b.materialName)
  );
}
