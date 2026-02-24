import { useState } from 'react';
import { v4 as uuid } from 'uuid';
import { WallTargetFace, WallOpening, HeaderStyle } from '../../types/wall';
import { useProject } from '../../hooks/useProject';
import { metersToDisplayUnit, getDisplayUnitLabel } from '../../core/units';
import { DEFAULT_MATERIALS } from '../../core/materials';

interface WallPanelProps {
  target: WallTargetFace;
  onGenerate: (
    studMaterialId: string,
    plateMaterialId: string,
    studSpacing: number,
    doubleTopPlate: boolean,
    openings: WallOpening[],
  ) => void;
  onCancel: () => void;
}

const HEADER_STYLE_LABELS: Record<HeaderStyle, string> = {
  'built-up':    'Built-up (2-ply + ply)',
  'single-2x6':  'Single 2×6',
  'single-2x8':  'Single 2×8',
  'single-2x10': 'Single 2×10',
};

const IN = 0.0254;

export function WallPanel({ target, onGenerate, onCancel }: WallPanelProps) {
  const { project } = useProject();
  const unitSystem = project.unitSystem;

  const [studMaterialId, setStudMaterialId] = useState('2x4-lumber');
  const [plateMaterialId, setPlateMaterialId] = useState('2x4-lumber');
  const [studSpacingIn, setStudSpacingIn] = useState(16);
  const [doubleTopPlate, setDoubleTopPlate] = useState(true);
  const [defaultHeaderStyle, setDefaultHeaderStyle] = useState<HeaderStyle>('built-up');
  const [openings, setOpenings] = useState<WallOpening[]>([]);

  const fmt = (meters: number) => {
    const val = metersToDisplayUnit(meters, unitSystem);
    const unit = getDisplayUnitLabel(unitSystem);
    return `${val.toFixed(2)} ${unit}`;
  };

  const addDoor = () => {
    setOpenings((prev) => [
      ...prev,
      {
        id: uuid(),
        type: 'door',
        position: 0.5,
        width: 32 * IN,
        height: 80 * IN,
        headerStyle: defaultHeaderStyle,
      },
    ]);
  };

  const addWindow = () => {
    setOpenings((prev) => [
      ...prev,
      {
        id: uuid(),
        type: 'window',
        position: 1.0,
        width: 32 * IN,
        height: 48 * IN,
        sillHeight: 36 * IN,
        headerStyle: defaultHeaderStyle,
      },
    ]);
  };

  const updateOpening = (id: string, patch: Partial<WallOpening>) => {
    setOpenings((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  };

  const removeOpening = (id: string) => {
    setOpenings((prev) => prev.filter((o) => o.id !== id));
  };

  const handleGenerate = () => {
    onGenerate(studMaterialId, plateMaterialId, studSpacingIn * IN, doubleTopPlate, openings);
  };

  const lumberMaterials = DEFAULT_MATERIALS.filter(
    (m) => m.unitType === 'board_feet',
  );

  return (
    <div className="w-80 bg-white border-l border-slate-200 overflow-y-auto flex flex-col">
      <div className="p-4 border-b border-slate-200">
        <h2 className="text-slate-800 font-semibold text-base">Auto-Stud Wall</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Wall Info */}
        <section>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Wall Dimensions
          </h3>
          <div className="bg-slate-50 rounded-lg p-3 grid grid-cols-3 gap-2 text-sm">
            <div className="text-center">
              <div className="text-slate-400 text-xs">Length</div>
              <div className="text-slate-700 font-medium">{fmt(target.wallLength)}</div>
            </div>
            <div className="text-center">
              <div className="text-slate-400 text-xs">Height</div>
              <div className="text-slate-700 font-medium">{fmt(target.wallHeight)}</div>
            </div>
            <div className="text-center">
              <div className="text-slate-400 text-xs">Depth</div>
              <div className="text-slate-700 font-medium">{fmt(target.wallDepth)}</div>
            </div>
          </div>
        </section>

        {/* Framing */}
        <section>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Framing
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Stud Material</label>
              <select
                value={studMaterialId}
                onChange={(e) => setStudMaterialId(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {lumberMaterials.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-500 block mb-1">Plate Material</label>
              <select
                value={plateMaterialId}
                onChange={(e) => setPlateMaterialId(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {lumberMaterials.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-500 block mb-1">Stud Spacing (OC)</label>
              <div className="flex gap-2">
                {[12, 16, 24].map((sp) => (
                  <button
                    key={sp}
                    onClick={() => setStudSpacingIn(sp)}
                    className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      studSpacingIn === sp
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {sp}"
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={doubleTopPlate}
                onChange={(e) => setDoubleTopPlate(e.target.checked)}
                className="w-4 h-4 rounded accent-blue-500"
              />
              <span className="text-sm text-slate-700">Double top plate</span>
            </label>
          </div>
        </section>

        {/* Header Style */}
        <section>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Default Header Style
          </h3>
          <select
            value={defaultHeaderStyle}
            onChange={(e) => setDefaultHeaderStyle(e.target.value as HeaderStyle)}
            className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {(Object.entries(HEADER_STYLE_LABELS) as [HeaderStyle, string][]).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </section>

        {/* Openings */}
        <section>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Openings
          </h3>
          <div className="flex gap-2 mb-3">
            <button
              onClick={addDoor}
              className="flex-1 py-1.5 text-sm font-medium rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
            >
              + Door
            </button>
            <button
              onClick={addWindow}
              className="flex-1 py-1.5 text-sm font-medium rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
            >
              + Window
            </button>
          </div>

          {openings.length === 0 && (
            <p className="text-xs text-slate-400 italic">No openings added</p>
          )}

          {openings.map((opening, idx) => (
            <div key={opening.id} className="border border-slate-200 rounded-lg p-3 mb-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 capitalize">
                  {opening.type} #{idx + 1}
                </span>
                <button
                  onClick={() => removeOpening(opening.id)}
                  className="text-slate-400 hover:text-red-500 text-xs transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-400 block">Position (m from left)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={opening.position.toFixed(3)}
                    onChange={(e) => updateOpening(opening.id, { position: parseFloat(e.target.value) || 0 })}
                    className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 text-slate-700"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block">Width (m)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.1"
                    value={opening.width.toFixed(3)}
                    onChange={(e) => updateOpening(opening.id, { width: parseFloat(e.target.value) || 0.1 })}
                    className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 text-slate-700"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block">RO Height (m)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.1"
                    value={opening.height.toFixed(3)}
                    onChange={(e) => updateOpening(opening.id, { height: parseFloat(e.target.value) || 0.1 })}
                    className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 text-slate-700"
                  />
                </div>
                {opening.type === 'window' && (
                  <div>
                    <label className="text-xs text-slate-400 block">Sill Height (m)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={(opening.sillHeight ?? 0).toFixed(3)}
                      onChange={(e) => updateOpening(opening.id, { sillHeight: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 text-slate-700"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs text-slate-400 block">Header Style</label>
                <select
                  value={opening.headerStyle}
                  onChange={(e) => updateOpening(opening.id, { headerStyle: e.target.value as HeaderStyle })}
                  className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-400 text-slate-700 bg-white"
                >
                  {(Object.entries(HEADER_STYLE_LABELS) as [HeaderStyle, string][]).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </section>
      </div>

      {/* Footer buttons */}
      <div className="p-4 border-t border-slate-200 flex gap-2">
        <button
          onClick={handleGenerate}
          className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
        >
          Generate Studs
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-medium rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
