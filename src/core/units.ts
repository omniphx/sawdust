import { UnitSystem } from '../types';

const METERS_TO_FEET = 3.28084;
const METERS_TO_INCHES = 39.3701;
const METERS_TO_CM = 100;

export function metersToDisplayUnit(meters: number, unitSystem: UnitSystem): number {
  if (unitSystem === 'imperial') {
    return meters * METERS_TO_FEET;
  }
  return meters * METERS_TO_CM;
}

export function displayUnitToMeters(value: number, unitSystem: UnitSystem): number {
  if (unitSystem === 'imperial') {
    return value / METERS_TO_FEET;
  }
  return value / METERS_TO_CM;
}

export function getDisplayUnitLabel(unitSystem: UnitSystem): string {
  return unitSystem === 'imperial' ? 'ft' : 'cm';
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
