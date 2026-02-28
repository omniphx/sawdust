import { useEffect } from 'react';
import { v4 as uuid } from 'uuid';
import { Box, BoxCut, CutEdge, CutFace } from '../../types';
import { UnitSystem } from '../../types';
import { useCutFaceHover } from '../../store/cutFaceHoverContext';
import { FACE_EDGES, DEFAULT_EDGE } from '../../core/cuts';

const FACE_LABELS: Record<CutFace, string> = {
  left: 'L',
  right: 'R',
  top: 'Top',
  bottom: 'Btm',
  front: 'Fr',
  back: 'Bk',
};

const EDGE_LABELS: Record<CutEdge, string> = {
  front: 'Front',
  back: 'Back',
  top: 'Top',
  bottom: 'Bottom',
};

const ANGLE_PRESETS = [45, 22.5, 0];
const ALL_FACES: CutFace[] = ['top', 'left', 'front', 'right', 'back', 'bottom'];

interface CutsSectionProps {
  box: Box;
  unitSystem?: UnitSystem;
  onUpdateCuts: (cuts: BoxCut[]) => void;
}

export function CutsSection({ box, onUpdateCuts }: CutsSectionProps) {
  const cuts = box.cuts ?? [];
  const { setHoveredCutFace } = useCutFaceHover();

  // Clear highlight when this component unmounts (box deselected)
  useEffect(() => {
    return () => setHoveredCutFace(null);
  }, []);

  const addCut = () => {
    onUpdateCuts([...cuts, { id: uuid(), face: 'left', angle: 45 }]);
  };

  const updateCut = (id: string, updates: Partial<BoxCut>) => {
    onUpdateCuts(cuts.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const removeCut = (id: string) => {
    onUpdateCuts(cuts.filter((c) => c.id !== id));
  };

  return (
    <div>
      <h3 className="text-slate-600 text-sm font-medium mb-2">Cuts</h3>
      {cuts.map((cut) => {
        const edges = FACE_EDGES[cut.face];
        const activeEdge = cut.edge ?? DEFAULT_EDGE[cut.face];
        return (
          <div key={cut.id} className="mb-3 p-2 bg-slate-50 rounded-lg border border-slate-200">
            {/* Face selector — cube net layout */}
            <div className="mb-2">
              <label className="text-slate-500 text-xs mb-1 block">Face</label>
              <div
                className="grid gap-0.5"
                style={{
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gridTemplateRows: 'repeat(3, 1fr)',
                }}
                onMouseEnter={() => setHoveredCutFace({ boxId: box.id, face: cut.face })}
                onMouseLeave={() => setHoveredCutFace(null)}
              >
                {ALL_FACES.map((face) => {
                  // Cube net positions: top(1,0), left(0,1), front(1,1), right(2,1), back(3,1), bottom(1,2)
                  const gridPos: Record<CutFace, { col: number; row: number }> = {
                    top:    { col: 2, row: 1 },
                    left:   { col: 1, row: 2 },
                    front:  { col: 2, row: 2 },
                    right:  { col: 3, row: 2 },
                    back:   { col: 4, row: 2 },
                    bottom: { col: 2, row: 3 },
                  };
                  const pos = gridPos[face];
                  return (
                    <button
                      key={face}
                      onClick={() => {
                        updateCut(cut.id, { face, edge: undefined });
                        setHoveredCutFace({ boxId: box.id, face });
                      }}
                      onMouseEnter={() => setHoveredCutFace({ boxId: box.id, face })}
                      className={`px-1 py-1 text-xs rounded border transition-colors ${
                        cut.face === face
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-300'
                      }`}
                      style={{
                        gridColumn: pos.col,
                        gridRow: pos.row,
                      }}
                    >
                      {FACE_LABELS[face]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Edge selector — which edge the blade enters from */}
            <div className="flex items-center gap-2 mb-2">
              <label className="text-slate-500 text-xs w-10">Edge</label>
              <div className="flex gap-1">
                {edges.map((edge) => (
                  <button
                    key={edge}
                    onClick={() => updateCut(cut.id, { edge })}
                    className={`px-2 py-1 text-xs rounded border transition-colors ${
                      activeEdge === edge
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-300'
                    }`}
                  >
                    {EDGE_LABELS[edge]}
                  </button>
                ))}
              </div>
            </div>

            {/* Angle input + presets */}
            <div className="flex items-center gap-2 mb-2">
              <label className="text-slate-500 text-xs w-10">Angle</label>
              <input
                type="number"
                value={cut.angle}
                min={0}
                max={89}
                step={0.5}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v) && v >= 0 && v <= 89) {
                    updateCut(cut.id, { angle: v });
                  }
                }}
                className="w-14 px-2 py-1 bg-white border border-slate-300 rounded-lg text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <span className="text-slate-400 text-xs">°</span>
              {ANGLE_PRESETS.map((a) => (
                <button
                  key={a}
                  onClick={() => updateCut(cut.id, { angle: a })}
                  className={`px-1.5 py-0.5 text-xs rounded border transition-colors ${
                    cut.angle === a
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-300'
                  }`}
                >
                  {a}°
                </button>
              ))}
            </div>

            {/* Remove button */}
            <button
              onClick={() => removeCut(cut.id)}
              className="text-red-500 hover:text-red-700 text-xs font-medium transition-colors"
            >
              Remove cut
            </button>
          </div>
        );
      })}
      <button
        onClick={addCut}
        className="w-full px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg border border-slate-300 transition-colors"
      >
        + Add Cut
      </button>
    </div>
  );
}
