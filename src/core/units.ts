import { UnitSystem } from '../types';

const METERS_TO_FEET = 3.28084;
const METERS_TO_INCHES = 39.3701;
const METERS_TO_CM = 100;

export function metersToDisplayUnit(meters: number, unitSystem: UnitSystem): number {
  if (unitSystem === 'feet') return meters * METERS_TO_FEET;
  if (unitSystem === 'inches') return meters * METERS_TO_INCHES;
  return meters * METERS_TO_CM;
}

export function displayUnitToMeters(value: number, unitSystem: UnitSystem): number {
  if (unitSystem === 'feet') return value / METERS_TO_FEET;
  if (unitSystem === 'inches') return value / METERS_TO_INCHES;
  return value / METERS_TO_CM;
}

export function getDisplayUnitLabel(unitSystem: UnitSystem): string {
  if (unitSystem === 'feet') return 'ft';
  if (unitSystem === 'inches') return 'in';
  return 'cm';
}

export function metersToInches(meters: number): number {
  return meters * METERS_TO_INCHES;
}

export function inchesToMeters(inches: number): number {
  return inches / METERS_TO_INCHES;
}

// Format a dimension for display
export function formatDimension(meters: number, unitSystem: UnitSystem): string {
  const value = metersToDisplayUnit(meters, unitSystem);
  const unit = getDisplayUnitLabel(unitSystem);
  return `${value.toFixed(2)} ${unit}`;
}

// Convert cubic meters to cubic feet
export function cubicMetersToFeet(cubicMeters: number): number {
  return cubicMeters * Math.pow(METERS_TO_FEET, 3);
}

// Convert square meters to square feet
export function squareMetersToFeet(squareMeters: number): number {
  return squareMeters * Math.pow(METERS_TO_FEET, 2);
}

// Convert meters to linear feet
export function metersToLinearFeet(meters: number): number {
  return meters * METERS_TO_FEET;
}

// Board feet calculation: (thickness in inches * width in inches * length in feet) / 12
// For our boxes, we'll assume the smallest dimension is thickness, medium is width, largest is length
export function calculateBoardFeet(widthM: number, heightM: number, depthM: number): number {
  const dims = [widthM, heightM, depthM].sort((a, b) => a - b);
  const thicknessInches = metersToInches(dims[0]);
  const widthInches = metersToInches(dims[1]);
  const lengthFeet = metersToLinearFeet(dims[2]);
  return (thicknessInches * widthInches * lengthFeet) / 12;
}

/** Snap increment in meters for each unit system */
export function getSnapIncrement(unitSystem: UnitSystem): number {
  if (unitSystem === 'metric') return 0.01;  // 1 cm
  if (unitSystem === 'inches') return 0.0254;  // 1 inch
  return 0.3048;  // 1 foot
}

/** Snap a value in meters to the nearest grid increment */
export function snapToGrid(meters: number, unitSystem: UnitSystem): number {
  const increment = getSnapIncrement(unitSystem);
  return Math.round(meters / increment) * increment;
}

/** Normalize legacy unit system values (e.g. 'imperial' from old saved projects) */
export function normalizeUnitSystem(value: string): UnitSystem {
  if (value === 'imperial') return 'feet';
  if (value === 'feet' || value === 'inches' || value === 'metric') return value;
  return 'feet';
}
