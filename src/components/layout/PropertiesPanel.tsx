import { useState } from 'react';
import { useSelection } from '../../hooks/useSelection';
import { useProject } from '../../hooks/useProject';
import { useProjectStore } from '../../store/projectStore';
import { DimensionInput } from '../ui/DimensionInput';
import { MaterialPicker } from '../ui/MaterialPicker';
import { CutsSection } from '../ui/CutsSection';
import { getMaterialById } from '../../core/materials';
import { ZERO_ROTATION } from '../../core/rotation';

export function PropertiesPanel() {
  const { selectedBox, selectedBoxIds, updateBox, deleteBox } = useSelection();
  const { duplicateSelectedBoxes, deleteSelectedBoxes, toggleLockSelectedBoxes, toggleVisibilitySelectedBoxes, rotateSelectedBoxes, getSelectedBoxes, createComponentFromSelected, historyBatchStart, historyBatchEnd } = useProjectStore();
  const { project } = useProject();
  const [showSaveComponent, setShowSaveComponent] = useState(false);
  const [componentName, setComponentName] = useState('');
  const [rotateAxis, setRotateAxis] = useState<'x' | 'y' | 'z'>('y');
  const [customAngle, setCustomAngle] = useState('');

  if (selectedBoxIds.length === 0) {
    return null;
  }

  // Multi-select summary
  if (selectedBoxIds.length > 1) {
    const selectedBoxesArr = getSelectedBoxes();
    const allLocked = selectedBoxesArr.every((b) => b.locked);
    const allHidden = selectedBoxesArr.every((b) => b.hidden);

    // Compute bounding box min corner (group position)
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    for (const b of selectedBoxesArr) {
      minX = Math.min(minX, b.position.x);
      minY = Math.min(minY, b.position.y);
      minZ = Math.min(minZ, b.position.z);
    }

    // User-facing axes: User X = Three.js Z, User Y = Three.js X, User Z = Three.js Y
    const groupUserPosition = { x: minZ, y: minX, z: minY };

    const handleGroupPositionChange = (userAxis: 'x' | 'y' | 'z', value: number) => {
      const internalAxis: 'x' | 'y' | 'z' = userAxis === 'x' ? 'z' : userAxis === 'y' ? 'x' : 'y';
      const oldValue = internalAxis === 'x' ? minX : internalAxis === 'y' ? minY : minZ;
      const delta = value - oldValue;
      if (delta === 0) return;

      historyBatchStart();
      for (const b of selectedBoxesArr) {
        updateBox(b.id, {
          position: { ...b.position, [internalAxis]: b.position[internalAxis] + delta },
        });
      }
      historyBatchEnd();
    };

    return (
      <div className="w-72 bg-white border-l border-slate-200 p-4 overflow-y-auto">
        <h2 className="text-slate-800 font-semibold mb-4">Properties</h2>
        <p className="text-slate-600 text-sm mb-4">
          {selectedBoxIds.length} items selected
        </p>

        {/* Position */}
        <div className="mb-6">
          <h3 className="text-slate-600 text-sm font-medium mb-2">Position</h3>
          <div className="space-y-2">
            <DimensionInput
              label="X"
              value={groupUserPosition.x}
              unitSystem={project.unitSystem}
              onChange={(v) => handleGroupPositionChange('x', v)}
              min={-100}
            />
            <DimensionInput
              label="Y"
              value={groupUserPosition.y}
              unitSystem={project.unitSystem}
              onChange={(v) => handleGroupPositionChange('y', v)}
              min={-100}
            />
            <DimensionInput
              label="Z"
              value={groupUserPosition.z}
              unitSystem={project.unitSystem}
              onChange={(v) => handleGroupPositionChange('z', v)}
              min={0}
            />
          </div>
        </div>

        {/* Rotate */}
        <div>
          <h3 className="text-slate-600 text-sm font-medium mb-2">Rotate</h3>
          <div className="flex gap-1 mb-2">
            {(['x', 'y', 'z'] as const).map((a) => (
              <button
                key={a}
                onClick={() => setRotateAxis(a)}
                className={`flex-1 px-2 py-1 text-xs font-medium rounded-lg border transition-colors ${
                  rotateAxis === a
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                }`}
              >
                {a.toUpperCase()} Axis
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            <input
              type="number"
              value={customAngle}
              onChange={(e) => setCustomAngle(e.target.value)}
              placeholder="Angle°"
              className="flex-1 min-w-0 px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const deg = parseFloat(customAngle);
                  if (!isNaN(deg)) {
                    rotateSelectedBoxes((deg * Math.PI) / 180, rotateAxis);
                    setCustomAngle('');
                  }
                }
              }}
            />
            <button
              onClick={() => {
                const deg = parseFloat(customAngle);
                if (!isNaN(deg)) {
                  rotateSelectedBoxes((deg * Math.PI) / 180, rotateAxis);
                  setCustomAngle('');
                }
              }}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg transition-colors"
            >
              Apply
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => toggleLockSelectedBoxes()}
            className="w-full px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
          >
            {allLocked ? 'Unlock All' : 'Lock All'}
          </button>
          <button
            onClick={() => toggleVisibilitySelectedBoxes()}
            className="w-full px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
          >
            {allHidden ? 'Show All' : 'Hide All'}
          </button>
          <button
            onClick={() => duplicateSelectedBoxes()}
            className="w-full px-4 py-2 bg-slate-500 hover:bg-slate-600 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
          >
            Duplicate All
          </button>
          <button
            onClick={() => deleteSelectedBoxes()}
            className="w-full px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
          >
            Delete All
          </button>
          <div className="h-px bg-slate-200 my-1" />
          {showSaveComponent ? (
            <div className="space-y-2">
              <input
                type="text"
                value={componentName}
                onChange={(e) => setComponentName(e.target.value)}
                placeholder="Component name..."
                autoFocus
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    createComponentFromSelected(componentName);
                    setShowSaveComponent(false);
                    setComponentName('');
                  } else if (e.key === 'Escape') {
                    setShowSaveComponent(false);
                    setComponentName('');
                  }
                }}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    createComponentFromSelected(componentName);
                    setShowSaveComponent(false);
                    setComponentName('');
                  }}
                  className="flex-1 px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setShowSaveComponent(false);
                    setComponentName('');
                  }}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-medium rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowSaveComponent(true)}
              className="w-full px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
            >
              Save as Component
            </button>
          )}
        </div>
      </div>
    );
  }

  // Single selection - existing behavior
  if (!selectedBox) {
    return null;
  }

  const material = getMaterialById(selectedBox.materialId);

  const handleDimensionChange = (key: 'width' | 'height' | 'depth', value: number) => {
    updateBox(selectedBox.id, {
      dimensions: { ...selectedBox.dimensions, [key]: value },
    });
  };

  // Remap user-facing axes to Three.js axes for the isometric view:
  // User X (left-right on ground) = Three.js Z
  // User Y (forward-back on ground) = Three.js X
  // User Z (height) = Three.js Y
  const handleUserPositionChange = (userAxis: 'x' | 'y' | 'z', value: number) => {
    const internalAxis: 'x' | 'y' | 'z' = userAxis === 'x' ? 'z' : userAxis === 'y' ? 'x' : 'y';
    const oldValue = selectedBox.position[internalAxis];
    const delta = value - oldValue;

    // If grouped, batch all updates so they undo as one step
    const hasGroupMembers = selectedBox.groupId && delta !== 0;
    if (hasGroupMembers) historyBatchStart();

    updateBox(selectedBox.id, { position: { ...selectedBox.position, [internalAxis]: value } });

    // If grouped, apply the same delta to all other group members
    if (hasGroupMembers) {
      for (const b of project.boxes) {
        if (b.groupId === selectedBox.groupId && b.id !== selectedBox.id) {
          updateBox(b.id, {
            position: { ...b.position, [internalAxis]: b.position[internalAxis] + delta },
          });
        }
      }
      historyBatchEnd();
    }
  };

  // Convert internal position to user-facing coordinates
  const userPosition = {
    x: selectedBox.position.z,
    y: selectedBox.position.x,
    z: selectedBox.position.y,
  };

  const handleRotate = (swap: 'wd' | 'hd' | 'wh') => {
    const { width, height, depth } = selectedBox.dimensions;
    let newDims = { width, height, depth };
    let newPos = { ...selectedBox.position };

    if (swap === 'wd') {
      newDims = { width: depth, height, depth: width };
    } else if (swap === 'hd') {
      newDims = { width, height: depth, depth: height };
      newPos.y = 0;
    } else {
      newDims = { width: height, height: width, depth };
      newPos.y = 0;
    }

    updateBox(selectedBox.id, {
      dimensions: newDims,
      position: newPos,
      rotation: { ...ZERO_ROTATION },
    });
  };

  const handleLabelChange = (label: string) => {
    updateBox(selectedBox.id, { label: label || undefined });
  };

  return (
    <div className="w-72 bg-white border-l border-slate-200 p-4 overflow-y-auto">
      <h2 className="text-slate-800 font-semibold mb-4">Properties</h2>

      <div className="space-y-6">
        {/* Material */}
        <div>
          <h3 className="text-slate-600 text-sm font-medium mb-2">Material</h3>
          <MaterialPicker
            value={selectedBox.materialId}
            onChange={(materialId) => updateBox(selectedBox.id, { materialId })}
          />
          {material && (
            <div className="mt-2 flex items-center gap-2">
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: material.color }}
              />
              <span className="text-slate-400 text-xs capitalize">
                {material.unitType.replace('_', ' ')}
              </span>
            </div>
          )}
        </div>

        {/* Label */}
        <div>
          <h3 className="text-slate-600 text-sm font-medium mb-2">Label</h3>
          <input
            type="text"
            value={selectedBox.label || ''}
            onChange={(e) => handleLabelChange(e.target.value)}
            placeholder="Optional label..."
            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {/* Dimensions */}
        <div>
          <h3 className="text-slate-600 text-sm font-medium mb-2">Dimensions</h3>
          <div className="space-y-2">
            <DimensionInput
              label="Width"
              value={selectedBox.dimensions.width}
              unitSystem={project.unitSystem}
              onChange={(v) => handleDimensionChange('width', v)}
            />
            <DimensionInput
              label="Height"
              value={selectedBox.dimensions.height}
              unitSystem={project.unitSystem}
              onChange={(v) => handleDimensionChange('height', v)}
            />
            <DimensionInput
              label="Depth"
              value={selectedBox.dimensions.depth}
              unitSystem={project.unitSystem}
              onChange={(v) => handleDimensionChange('depth', v)}
            />
          </div>
        </div>

        {/* Position */}
        <div>
          <h3 className="text-slate-600 text-sm font-medium mb-2">Position</h3>
          <div className="space-y-2">
            <DimensionInput
              label="X"
              value={userPosition.x}
              unitSystem={project.unitSystem}
              onChange={(v) => handleUserPositionChange('x', v)}
              min={-100}
            />
            <DimensionInput
              label="Y"
              value={userPosition.y}
              unitSystem={project.unitSystem}
              onChange={(v) => handleUserPositionChange('y', v)}
              min={-100}
            />
            <DimensionInput
              label="Z"
              value={userPosition.z}
              unitSystem={project.unitSystem}
              onChange={(v) => handleUserPositionChange('z', v)}
              min={0}
            />
          </div>
        </div>

        {/* Rotate */}
        <div>
          <h3 className="text-slate-600 text-sm font-medium mb-2">Rotate</h3>
          <div className="flex gap-1 mb-2">
            {(['x', 'y', 'z'] as const).map((a) => (
              <button
                key={a}
                onClick={() => setRotateAxis(a)}
                className={`flex-1 px-2 py-1 text-xs font-medium rounded-lg border transition-colors ${
                  rotateAxis === a
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                }`}
              >
                {a.toUpperCase()} Axis
              </button>
            ))}
          </div>
          <div className="space-y-1 mb-2">
            {(['x', 'y', 'z'] as const).map((a) => (
              <div key={a} className="flex items-center gap-2">
                <label className="text-slate-500 text-xs w-12">{a.toUpperCase()}</label>
                <input
                  type="number"
                  value={Math.round((selectedBox.rotation[a] * 180) / Math.PI * 100) / 100}
                  onChange={(e) => {
                    const deg = parseFloat(e.target.value);
                    if (!isNaN(deg)) {
                      updateBox(selectedBox.id, {
                        rotation: { ...selectedBox.rotation, [a]: (deg * Math.PI) / 180 },
                      });
                    }
                  }}
                  className="flex-1 px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
                  step={15}
                />
                <span className="text-slate-400 text-xs">°</span>
              </div>
            ))}
          </div>
          <h4 className="text-slate-500 text-xs font-medium mb-1">Flip Axes</h4>
          <div className="flex gap-2">
            <button
              onClick={() => handleRotate('wd')}
              className="flex-1 px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg border border-slate-300 transition-colors"
              title="Swap Width and Depth (rotate around vertical axis)"
            >
              W ↔ D
            </button>
            <button
              onClick={() => handleRotate('hd')}
              className="flex-1 px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg border border-slate-300 transition-colors"
              title="Swap Height and Depth (rotate around left-right axis)"
            >
              H ↔ D
            </button>
            <button
              onClick={() => handleRotate('wh')}
              className="flex-1 px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg border border-slate-300 transition-colors"
              title="Swap Width and Height (rotate around front-back axis)"
            >
              W ↔ H
            </button>
          </div>
        </div>

        {/* Cuts */}
        <CutsSection
          box={selectedBox}
          unitSystem={project.unitSystem}
          onUpdateCuts={(cuts) => updateBox(selectedBox.id, { cuts })}
        />

        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={() => toggleLockSelectedBoxes()}
            className="w-full px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
          >
            {selectedBox.locked ? 'Unlock' : 'Lock'}
          </button>
          <button
            onClick={() => toggleVisibilitySelectedBoxes()}
            className="w-full px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
          >
            {selectedBox.hidden ? 'Show' : 'Hide'}
          </button>
          <button
            onClick={() => duplicateSelectedBoxes()}
            className="w-full px-4 py-2 bg-slate-500 hover:bg-slate-600 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
          >
            Duplicate Box
          </button>
          <button
            onClick={() => deleteBox(selectedBox.id)}
            className="w-full px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
          >
            Delete Box
          </button>
        </div>
      </div>
    </div>
  );
}
