import { useState } from 'react';

export function TriangleCalculator() {
  const [open, setOpen] = useState(false);
  const [a, setA] = useState('');
  const [b, setB] = useState('');

  const aNum = parseFloat(a);
  const bNum = parseFloat(b);
  const valid = !isNaN(aNum) && aNum > 0 && !isNaN(bNum) && bNum > 0;

  const c = valid ? Math.sqrt(aNum ** 2 + bNum ** 2) : null;
  // α = angle at bottom-right (between b and c) = arctan(a/b)
  const alpha = valid ? Math.atan2(aNum, bNum) * (180 / Math.PI) : null;
  // β = angle at top-left (between a and c) = arctan(b/a)
  const beta = valid ? Math.atan2(bNum, aNum) * (180 / Math.PI) : null;

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
            {/* Triangle fill */}
            <polygon points="10,80 110,80 10,10" fill="#eff6ff" stroke="#3b82f6" strokeWidth="1.5" />
            {/* Right-angle square marker */}
            <path d="M 10,70 L 20,70 L 20,80" fill="none" stroke="#3b82f6" strokeWidth="1" />
            {/* Side labels */}
            <text x="1" y="48" fontSize="11" fill="#1d4ed8" fontWeight="bold" fontFamily="sans-serif">a</text>
            <text x="55" y="93" fontSize="11" fill="#1d4ed8" fontWeight="bold" fontFamily="sans-serif">b</text>
            <text x="68" y="40" fontSize="11" fill="#1d4ed8" fontWeight="bold" fontFamily="sans-serif">c</text>
            {/* Angle label α at bottom-right */}
            <text x="86" y="77" fontSize="9" fill="#6b7280" fontFamily="sans-serif">α</text>
            {/* Angle label β at top-left */}
            <text x="14" y="26" fontSize="9" fill="#6b7280" fontFamily="sans-serif">β</text>
          </svg>

          {/* Inputs */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-blue-700 w-3">a</label>
              <input
                type="number"
                value={a}
                onChange={(e) => setA(e.target.value)}
                placeholder="0"
                min="0"
                step="any"
                className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-blue-700 w-3">b</label>
              <input
                type="number"
                value={b}
                onChange={(e) => setB(e.target.value)}
                placeholder="0"
                min="0"
                step="any"
                className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          </div>

          {/* Results */}
          <div className="mt-2.5 pt-2 border-t border-gray-100 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="font-bold text-blue-700">c</span>
              <span className="font-mono text-gray-800">{c !== null ? fmt(c) : '—'}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">α (at b–c)</span>
              <span className="font-mono text-gray-800">{alpha !== null ? `${fmt(alpha)}°` : '—'}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">β (at a–c)</span>
              <span className="font-mono text-gray-800">{beta !== null ? `${fmt(beta)}°` : '—'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
