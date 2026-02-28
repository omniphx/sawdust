import { useState, useCallback } from 'react';

function evaluateMathExpression(expr: string): number {
  const sanitized = expr.replace(/\s/g, '');
  if (!/^[0-9+\-*/.()]+$/.test(sanitized)) return NaN;
  if (/\(\)/.test(sanitized)) return NaN;
  try {
    const result = new Function(`"use strict"; return (${sanitized});`)();
    return typeof result === 'number' && isFinite(result) ? result : NaN;
  } catch {
    return NaN;
  }
}

function useMathInput(initial = '') {
  const [raw, setRaw] = useState(initial);
  const [num, setNum] = useState<number | null>(null);

  const handleChange = (value: string) => setRaw(value);

  const handleCommit = () => {
    const result = evaluateMathExpression(raw);
    if (!isNaN(result) && result > 0) {
      setNum(result);
      setRaw(String(result));
    } else if (raw === '' || raw === '0') {
      setNum(null);
      setRaw('');
    } else {
      // Revert to last valid value
      setRaw(num !== null ? String(num) : '');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
  };

  return { raw, num, handleChange, handleCommit, handleKeyDown };
}

function CopyableValue({ value, label }: { value: string | null; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  }, [value]);

  if (!value) {
    return <span className="font-mono text-gray-400">—</span>;
  }

  return (
    <span
      onClick={handleCopy}
      title={`Click to copy ${label}`}
      className="font-mono text-gray-800 cursor-pointer hover:text-blue-600 hover:underline select-none"
    >
      {copied ? <span className="text-green-600">copied!</span> : value}
    </span>
  );
}

export function TriangleCalculator() {
  const [open, setOpen] = useState(false);
  const sideA = useMathInput();
  const sideB = useMathInput();

  const aNum = sideA.num;
  const bNum = sideB.num;
  const valid = aNum !== null && bNum !== null && aNum > 0 && bNum > 0;

  const c = valid ? Math.sqrt(aNum! ** 2 + bNum! ** 2) : null;
  const alpha = valid ? Math.atan2(aNum!, bNum!) * (180 / Math.PI) : null;
  const beta  = valid ? Math.atan2(bNum!, aNum!) * (180 / Math.PI) : null;

  const fmt = (n: number) => {
    const s = n.toFixed(4);
    return s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  };

  return (
    <div
      className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden"
      style={{ minWidth: '44px' }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 whitespace-nowrap"
        title="Right Triangle Calculator"
      >
        <svg width="12" height="10" viewBox="0 0 12 10" fill="none" className="flex-shrink-0">
          <polygon points="0,10 12,10 0,0" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1.2" />
          <path d="M0,7 L3,7 L3,10" fill="none" stroke="#3b82f6" strokeWidth="0.9" />
        </svg>
        Tri Calc
        <span className="ml-auto text-gray-400">{open ? '▼' : '▲'}</span>
      </button>

      {open && (
        <div className="border-t border-gray-100 p-3 w-52">
          {/* SVG diagram: right angle at bottom-left, a=vertical, b=horizontal, c=hypotenuse */}
          <svg width="100%" viewBox="0 0 120 96" className="mb-3">
            <polygon points="10,80 110,80 10,10" fill="#eff6ff" stroke="#3b82f6" strokeWidth="1.5" />
            <path d="M 10,70 L 20,70 L 20,80" fill="none" stroke="#3b82f6" strokeWidth="1" />
            <text x="1" y="48" fontSize="11" fill="#1d4ed8" fontWeight="bold" fontFamily="sans-serif">a</text>
            <text x="55" y="93" fontSize="11" fill="#1d4ed8" fontWeight="bold" fontFamily="sans-serif">b</text>
            <text x="68" y="40" fontSize="11" fill="#1d4ed8" fontWeight="bold" fontFamily="sans-serif">c</text>
            <text x="86" y="77" fontSize="9" fill="#6b7280" fontFamily="sans-serif">α</text>
            <text x="14" y="26" fontSize="9" fill="#6b7280" fontFamily="sans-serif">β</text>
          </svg>

          {/* Inputs */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-blue-700 w-3">a</label>
              <input
                type="text"
                inputMode="decimal"
                value={sideA.raw}
                onChange={(e) => sideA.handleChange(e.target.value)}
                onBlur={sideA.handleCommit}
                onKeyDown={sideA.handleKeyDown}
                placeholder="0"
                className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-blue-700 w-3">b</label>
              <input
                type="text"
                inputMode="decimal"
                value={sideB.raw}
                onChange={(e) => sideB.handleChange(e.target.value)}
                onBlur={sideB.handleCommit}
                onKeyDown={sideB.handleKeyDown}
                placeholder="0"
                className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          </div>

          {/* Results */}
          <div className="mt-2.5 pt-2 border-t border-gray-100 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="font-bold text-blue-700">c</span>
              <CopyableValue value={c !== null ? fmt(c) : null} label="c" />
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">α (at b–c)</span>
              <CopyableValue value={alpha !== null ? `${fmt(alpha)}°` : null} label="α" />
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">β (at a–c)</span>
              <CopyableValue value={beta !== null ? `${fmt(beta)}°` : null} label="β" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
