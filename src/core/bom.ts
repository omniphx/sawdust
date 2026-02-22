import { Box, BOMEntry, UnitType, PurchaseEntry, PurchasePiece, UnitSystem } from '../types';
import { getMaterialById, STANDARD_PURCHASE_SIZES, SHEET_MATERIAL_IDS } from './materials';
import {
  calculateBoardFeet,
  squareMetersToFeet,
  cubicMetersToFeet,
  metersToLinearFeet,
  metersToDisplayUnit,
  getDisplayUnitLabel,
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

export function calculatePurchaseList(
  boxes: Box[],
  unitSystem: UnitSystem,
  customSizes?: Record<string, number>,
  customSheetSizes?: Record<string, { width: number; depth: number }>,
): PurchaseEntry[] {
  // Group boxes by materialId
  const groups = new Map<string, Box[]>();
  for (const box of boxes) {
    if (!groups.has(box.materialId)) {
      groups.set(box.materialId, []);
    }
    groups.get(box.materialId)!.push(box);
  }

  const entries: PurchaseEntry[] = [];
  const uLabel = getDisplayUnitLabel(unitSystem);

  for (const [materialId, materialBoxes] of groups) {
    const material = getMaterialById(materialId);
    if (!material) continue;

    // Skip non-applicable materials
    if (materialId === 'concrete' || materialId === 'heater') continue;

    const isSheet = SHEET_MATERIAL_IDS.has(materialId);

    let standardLength: number;
    let sheetWidth: number | undefined;

    if (isSheet && customSheetSizes?.[materialId]) {
      // Custom sheet size: use both width and depth
      sheetWidth = customSheetSizes[materialId].width;
      standardLength = customSheetSizes[materialId].depth;
    } else {
      standardLength = customSizes?.[materialId] ?? STANDARD_PURCHASE_SIZES[materialId];
      if (isSheet) {
        sheetWidth = material.defaultDimensions?.width;
      }
    }
    if (standardLength == null) continue;

    // Build standard size label
    const stdDisplay = parseFloat(metersToDisplayUnit(standardLength, unitSystem).toFixed(2));
    let standardSizeLabel: string;
    if (isSheet) {
      const wDisplay = sheetWidth
        ? parseFloat(metersToDisplayUnit(sheetWidth, unitSystem).toFixed(2))
        : stdDisplay;
      standardSizeLabel = `${wDisplay} × ${stdDisplay} ${uLabel} sheet`;
    } else {
      standardSizeLabel = `${stdDisplay} ${uLabel}`;
    }

    const pieces: PurchasePiece[] = materialBoxes.map((box) => {
      const dims = [box.dimensions.width, box.dimensions.height, box.dimensions.depth];
      const longestDim = Math.max(...dims);

      let oversized: boolean;
      if (isSheet) {
        // For sheet goods, check the two largest face dimensions against the sheet
        const sorted = [...dims].sort((a, b) => b - a);
        const sw = sheetWidth ?? standardLength;
        oversized = sorted[0] > standardLength + 0.001 || sorted[1] > sw + 0.001;
      } else {
        oversized = longestDim > standardLength + 0.001;
      }

      return {
        boxId: box.id,
        boxLabel: box.label || material.name,
        pieceLength: longestDim,
        oversized,
      };
    });

    entries.push({
      materialId,
      materialName: material.name,
      color: material.color,
      boardsNeeded: pieces.length, // 1 piece = 1 board
      standardSizeLabel,
      pieces,
    });
  }

  return entries.sort((a, b) => a.materialName.localeCompare(b.materialName));
}
