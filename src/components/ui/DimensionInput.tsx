import { useState, useEffect } from 'react';
import { UnitSystem } from '../../types';
import {
  metersToDisplayUnit,
  displayUnitToMeters,
  getDisplayUnitLabel,
} from '../../core/units';

/**
 * Safely evaluate a basic math expression (numbers, +, -, *, /, parentheses).
 * Returns NaN if the expression is invalid or contains disallowed characters.
 */
function evaluateMathExpression(expr: string): number {
  const sanitized = expr.replace(/\s/g, '');
  // Only allow digits, decimal points, operators, and parentheses
  if (!/^[0-9+\-*/.()]+$/.test(sanitized)) return NaN;
  // Reject empty parentheses or other malformed patterns
  if (/\(\)/.test(sanitized)) return NaN;
  try {
    // Using Function constructor as a sandboxed eval — the regex above
    // ensures only numeric/math characters are present
    const result = new Function(`"use strict"; return (${sanitized});`)();
    return typeof result === 'number' && isFinite(result) ? result : NaN;
  } catch {
    return NaN;
  }
}

interface DimensionInputProps {
  label: string;
  value: number; // in meters
  unitSystem: UnitSystem;
  onChange: (meters: number) => void;
  min?: number;
}

export function DimensionInput({
  label,
  value,
  unitSystem,
  onChange,
  min = 0.01,
}: DimensionInputProps) {
  const displayValue = metersToDisplayUnit(value, unitSystem);
  const [inputValue, setInputValue] = useState(displayValue.toFixed(2));

  useEffect(() => {
    setInputValue(metersToDisplayUnit(value, unitSystem).toFixed(2));
  }, [value, unitSystem]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleBlur = () => {
    const result = evaluateMathExpression(inputValue);
    if (!isNaN(result) && result >= min) {
      const meters = displayUnitToMeters(result, unitSystem);
      onChange(meters);
    } else {
      setInputValue(displayValue.toFixed(2));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <label className="text-slate-500 text-sm w-16">{label}</label>
      <input
        type="text"
        inputMode="decimal"
        value={inputValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="flex-1 px-2 py-1 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      <span className="text-slate-400 text-sm w-8">{getDisplayUnitLabel(unitSystem)}</span>
    </div>
  );
}
