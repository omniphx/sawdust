import { useSelection } from '../../hooks/useSelection';
import { useProject } from '../../hooks/useProject';
import { useProjectStore } from '../../store/projectStore';
import { DimensionInput } from '../ui/DimensionInput';
import { MaterialPicker } from '../ui/MaterialPicker';
import { getMaterialById } from '../../core/materials';

export function PropertiesPanel() {
  const { selectedBox, updateBox, deleteBox } = useSelection();
  const { duplicateBox } = useProjectStore();
  const { project } = useProject();

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
    if (userAxis === 'x') {
      updateBox(selectedBox.id, { position: { ...selectedBox.position, z: value } });
    } else if (userAxis === 'y') {
      updateBox(selectedBox.id, { position: { ...selectedBox.position, x: value } });
    } else {
      updateBox(selectedBox.id, { position: { ...selectedBox.position, y: value } });
    }
  };

  // Convert internal position to user-facing coordinates
  const userPosition = {
    x: selectedBox.position.z,
    y: selectedBox.position.x,
    z: selectedBox.position.y,
  };

  const handleRotationChange = (degrees: number) => {
    updateBox(selectedBox.id, {
      rotation: (degrees * Math.PI) / 180,
    });
  };

  const handleLabelChange = (label: string) => {
    updateBox(selectedBox.id, { label: label || undefined });
  };

  const rotationDegrees = Math.round((selectedBox.rotation * 180) / Math.PI);

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

        {/* Rotation */}
        <div>
          <h3 className="text-slate-600 text-sm font-medium mb-2">Rotation (Y-axis)</h3>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={rotationDegrees}
              onChange={(e) => handleRotationChange(parseInt(e.target.value) || 0)}
              step="15"
              className="flex-1 px-2 py-1 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <span className="text-slate-400 text-sm">deg</span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={() => duplicateBox(selectedBox.id)}
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
