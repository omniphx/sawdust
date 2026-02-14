import { useProjectStore } from '../../store/projectStore';
import { useProject } from '../../hooks/useProject';

export function Toolbar() {
  const { addBox } = useProjectStore();
  const { project, setUnitSystem } = useProject();

  return (
    <div className="h-14 bg-gray-800 border-b border-gray-700 flex items-center px-4 gap-4">
      <h1 className="text-white font-bold text-lg">OpenCAD</h1>

      <div className="h-6 w-px bg-gray-600" />

      <button
        onClick={() => addBox()}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition-colors"
      >
        Add Box
      </button>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <span className="text-gray-400 text-sm">Units:</span>
        <button
          onClick={() => setUnitSystem('imperial')}
          className={`px-3 py-1 text-sm rounded transition-colors ${
            project.unitSystem === 'imperial'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Imperial
        </button>
        <button
          onClick={() => setUnitSystem('metric')}
          className={`px-3 py-1 text-sm rounded transition-colors ${
            project.unitSystem === 'metric'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Metric
        </button>
      </div>
    </div>
  );
}
