import { useMemo, useState } from 'react';
import { useProject } from '../../hooks/useProject';
import { useProjectStore } from '../../store/projectStore';
import { getMaterialById, PURCHASE_LENGTH_OPTIONS, STANDARD_PURCHASE_SIZES } from '../../core/materials';
import { metersToDisplayUnit, getDisplayUnitLabel } from '../../core/units';
import { calculatePurchaseList } from '../../core/bom';

export function BOMPanel() {
  const { project } = useProject();
  const { state, selectBoxes } = useProjectStore();

  const [showPurchaseCalc, setShowPurchaseCalc] = useState(false);
  const [customSizes, setCustomSizes] = useState<Record<string, number>>({});

  const unitLabel = getDisplayUnitLabel(project.unitSystem);

  const formatDim = (meters: number) => {
    const val = metersToDisplayUnit(meters, project.unitSystem);
    return parseFloat(val.toFixed(2)).toString();
  };

  // Group boxes by material for organization
  const groupedBoxes = useMemo(() => {
    const groups = new Map<string, { materialName: string; color: string; boxes: typeof project.boxes }>();
    for (const box of project.boxes) {
      const material = getMaterialById(box.materialId);
      const name = material?.name ?? 'Unknown';
      const color = material?.color ?? '#888888';
      if (!groups.has(box.materialId)) {
        groups.set(box.materialId, { materialName: name, color, boxes: [] });
      }
      groups.get(box.materialId)!.boxes.push(box);
    }
    return Array.from(groups.values()).sort((a, b) =>
      a.materialName.localeCompare(b.materialName)
    );
  }, [project.boxes]);

  const purchaseList = useMemo(() => {
    if (!showPurchaseCalc || project.boxes.length === 0) return [];
    return calculatePurchaseList(project.boxes, project.unitSystem, customSizes);
  }, [showPurchaseCalc, project.boxes, project.unitSystem, customSizes]);

  const handleSizeChange = (materialId: string, meters: number) => {
    setCustomSizes((prev) => ({ ...prev, [materialId]: meters }));
  };

  return (
    <div className="w-64 bg-white border-l border-slate-200 p-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-slate-800 font-semibold">Bill of Materials</h2>
        {project.boxes.length > 0 && (
          <button
            onClick={() => setShowPurchaseCalc(!showPurchaseCalc)}
            className={`text-xs px-2 py-1 rounded border transition-colors ${
              showPurchaseCalc
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
            }`}
            title="Toggle purchase calculator"
          >
            {showPurchaseCalc ? 'Buy List' : 'Buy List'}
          </button>
        )}
      </div>

      {project.boxes.length === 0 ? (
        <p className="text-slate-400 text-sm">No materials yet. Add some boxes!</p>
      ) : showPurchaseCalc ? (
        /* Purchase Calculator View */
        <div className="space-y-4">
          {purchaseList.length === 0 ? (
            <p className="text-slate-400 text-sm">No purchasable materials.</p>
          ) : (
            purchaseList.map((entry) => {
              const currentSize = customSizes[entry.materialId] ?? STANDARD_PURCHASE_SIZES[entry.materialId];
              return (
                <div key={entry.materialId}>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="w-3 h-3 rounded border border-slate-300 flex-shrink-0"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-slate-700 text-xs font-semibold uppercase tracking-wide flex-1">
                      {entry.materialName}
                    </span>
                    <span className="text-slate-800 text-xs font-bold">
                      {entry.boardsNeeded}
                    </span>
                  </div>

                  {/* Standard size dropdown */}
                  <div className="mb-1.5 ml-5">
                    <select
                      className="text-xs bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-slate-600"
                      value={currentSize}
                      onChange={(e) => handleSizeChange(entry.materialId, Number(e.target.value))}
                    >
                      {PURCHASE_LENGTH_OPTIONS.map((opt) => (
                        <option key={opt.meters} value={opt.meters}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <span className="text-slate-400 text-xs ml-1.5">
                      std length
                    </span>
                  </div>

                  {/* Piece list */}
                  <div className="space-y-0.5">
                    {entry.pieces.map((piece) => (
                      <button
                        key={piece.boxId}
                        onClick={() => selectBoxes([piece.boxId])}
                        className={`w-full text-left rounded px-2 py-1 border transition-colors text-xs ${
                          state.selectedBoxIds.includes(piece.boxId)
                            ? 'bg-blue-50 border-blue-200'
                            : 'bg-slate-50 border-slate-100 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-slate-700 truncate">
                            {piece.boxLabel}
                          </span>
                          <span className={`flex-shrink-0 ml-1 ${piece.oversized ? 'text-amber-600 font-semibold' : 'text-slate-400'}`}>
                            {formatDim(piece.pieceLength)} {unitLabel}
                            {piece.oversized && ' ⚠'}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Standard BOM View */
        <div className="space-y-4">
          {groupedBoxes.map((group) => (
            <div key={group.materialName}>
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="w-3 h-3 rounded border border-slate-300 flex-shrink-0"
                  style={{ backgroundColor: group.color }}
                />
                <span className="text-slate-700 text-xs font-semibold uppercase tracking-wide">
                  {group.materialName}
                </span>
                <span className="text-slate-400 text-xs">
                  ({group.boxes.length})
                </span>
              </div>
              <div className="space-y-1">
                {group.boxes.map((box) => (
                  <button
                    key={box.id}
                    onClick={() => selectBoxes([box.id])}
                    className={`w-full text-left rounded-lg p-2 border transition-colors ${
                      state.selectedBoxIds.includes(box.id)
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-slate-50 border-slate-100 hover:bg-slate-100'
                    }`}
                  >
                    <div className="text-slate-800 text-sm font-medium">
                      {box.label || group.materialName}
                    </div>
                    <div className="text-slate-400 text-xs mt-0.5">
                      {formatDim(box.dimensions.width)} × {formatDim(box.dimensions.height)} × {formatDim(box.dimensions.depth)} {unitLabel}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {project.boxes.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-200">
          <div className="text-slate-400 text-xs">
            {project.boxes.length} item{project.boxes.length !== 1 ? 's' : ''} total
          </div>
        </div>
      )}
    </div>
  );
}
