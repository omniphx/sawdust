import { useSelection } from '../../hooks/useSelection';
import { useProject } from '../../hooks/useProject';
import { DimensionInput } from '../ui/DimensionInput';
import { MaterialPicker } from '../ui/MaterialPicker';
import { getMaterialById } from '../../core/materials';

export function PropertiesPanel() {
  const { selectedBox, updateBox, deleteBox } = useSelection();
  const { project } = useProject();

  if (!selectedBox) {
    return (
      <div className="w-72 bg-gray-800 border-l border-gray-700 p-4">
        <h2 className="text-white font-semibold mb-4">Properties</h2>
        <p className="text-gray-500 text-sm">Select a box to edit its properties</p>
      </div>
    );
  }

  const material = getMaterialById(selectedBox.materialId);

  const handleDimensionChange = (key: 'width' | 'height' | 'depth', value: number) => {
    updateBox(selectedBox.id, {
      dimensions: { ...selectedBox.dimensions, [key]: value },
    });
  };

  const handlePositionChange = (key: 'x' | 'y' | 'z', value: number) => {
    updateBox(selectedBox.id, {
      position: { ...selectedBox.position, [key]: value },
    });
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
    <div className="w-72 bg-gray-800 border-l border-gray-700 p-4 overflow-y-auto">
      <h2 className="text-white font-semibold mb-4">Properties</h2>

      <div className="space-y-6">
        {/* Material */}
        <div>
          <h3 className="text-gray-300 text-sm font-medium mb-2">Material</h3>
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
              <span className="text-gray-400 text-xs capitalize">
                {material.unitType.replace('_', ' ')}
              </span>
            </div>
          )}
        </div>

        {/* Label */}
        <div>
          <h3 className="text-gray-300 text-sm font-medium mb-2">Label</h3>
          <input
            type="text"
            value={selectedBox.label || ''}
            onChange={(e) => handleLabelChange(e.target.value)}
            placeholder="Optional label..."
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Dimensions */}
        <div>
          <h3 className="text-gray-300 text-sm font-medium mb-2">Dimensions</h3>
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
          <h3 className="text-gray-300 text-sm font-medium mb-2">Position</h3>
          <div className="space-y-2">
            <DimensionInput
              label="X"
              value={selectedBox.position.x}
              unitSystem={project.unitSystem}
              onChange={(v) => handlePositionChange('x', v)}
              min={-100}
            />
            <DimensionInput
              label="Y"
              value={selectedBox.position.y}
              unitSystem={project.unitSystem}
              onChange={(v) => handlePositionChange('y', v)}
              min={0}
            />
            <DimensionInput
              label="Z"
              value={selectedBox.position.z}
              unitSystem={project.unitSystem}
              onChange={(v) => handlePositionChange('z', v)}
              min={-100}
            />
          </div>
        </div>

        {/* Rotation */}
        <div>
          <h3 className="text-gray-300 text-sm font-medium mb-2">Rotation (Y-axis)</h3>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={rotationDegrees}
              onChange={(e) => handleRotationChange(parseInt(e.target.value) || 0)}
              step="15"
              className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-400 text-sm">deg</span>
          </div>
        </div>

        {/* Delete */}
        <button
          onClick={() => deleteBox(selectedBox.id)}
          className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded transition-colors"
        >
          Delete Box
        </button>
      </div>
    </div>
  );
}
