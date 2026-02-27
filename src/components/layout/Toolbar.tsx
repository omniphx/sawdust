import { useState, useRef, useEffect } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useProject } from '../../hooks/useProject';
import { DEFAULT_MATERIALS } from '../../core/materials';
import { exportProject } from '../../core/export';

interface ToolbarProps {
  onToggleComponentLibrary?: () => void;
  showComponentLibrary?: boolean;
  isMeasuring?: boolean;
  onToggleMeasure?: () => void;
  isWallMode?: boolean;
  onToggleWallMode?: () => void;
}

export function Toolbar({ onToggleComponentLibrary, showComponentLibrary, isMeasuring, onToggleMeasure, isWallMode, onToggleWallMode }: ToolbarProps) {
  const { state, addBox, saveComponent, cancelComponentBuilder, toggleSnap, undo, redo, canUndo, canRedo, importProject } = useProjectStore();
  const { project, setUnitSystem } = useProject();
  const [componentName, setComponentName] = useState(state.currentTemplate?.name ?? '');
  const [showMaterialMenu, setShowMaterialMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isBuilderMode = state.mode === 'component-builder';

  // Sync component name when entering builder mode (e.g. editing existing template)
  useEffect(() => {
    if (isBuilderMode) {
      setComponentName(state.currentTemplate?.name ?? '');
    }
  }, [isBuilderMode]);

  // Close menu on outside click
  useEffect(() => {
    if (!showMaterialMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMaterialMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMaterialMenu]);

  const handleSave = () => {
    const name = componentName.trim() || 'Untitled Component';
    saveComponent(name);
    setComponentName('');
  };

  const handleCancel = () => {
    cancelComponentBuilder();
    setComponentName('');
  };

  return (
    <div className="h-14 bg-white border-b border-slate-200 shadow-sm flex items-center px-4 gap-4">
      <h1 className="text-slate-800 font-bold text-lg tracking-tight">Sawdust</h1>

      {isBuilderMode && (
        <span className="px-2 py-0.5 bg-amber-400 text-amber-900 text-xs font-semibold rounded-full">
          Builder Mode
        </span>
      )}

      <div className="h-6 w-px bg-slate-200" />

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setShowMaterialMenu((v) => !v)}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-lg shadow-sm transition-colors flex items-center gap-1"
        >
          + Add Box
          <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {showMaterialMenu && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-50 min-w-[200px]">
            {DEFAULT_MATERIALS.map((mat) => (
              <button
                key={mat.id}
                onClick={() => {
                  addBox(mat.id);
                  setShowMaterialMenu(false);
                }}
                className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
              >
                <span
                  className="w-4 h-4 rounded border border-slate-300 flex-shrink-0"
                  style={{ backgroundColor: mat.color }}
                />
                {mat.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={undo}
          disabled={!canUndo}
          className={`p-2 rounded-lg transition-colors ${
            canUndo
              ? 'text-slate-600 hover:bg-slate-200'
              : 'text-slate-300 cursor-not-allowed'
          }`}
          title="Undo (⌘Z)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4" />
          </svg>
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          className={`p-2 rounded-lg transition-colors ${
            canRedo
              ? 'text-slate-600 hover:bg-slate-200'
              : 'text-slate-300 cursor-not-allowed'
          }`}
          title="Redo (⇧⌘Z)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a5 5 0 00-5 5v2M21 10l-4-4M21 10l-4 4" />
          </svg>
        </button>
      </div>

      {isBuilderMode ? (
        <>
          <div className="h-6 w-px bg-slate-200" />
          <input
            type="text"
            value={componentName}
            onChange={(e) => setComponentName(e.target.value)}
            placeholder="Component name..."
            className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-48"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
            }}
          />
          <button
            onClick={handleSave}
            disabled={(state.currentTemplate?.boxes.length ?? 0) === 0}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
          >
            Save Component
          </button>
          <button
            onClick={handleCancel}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-medium rounded-lg transition-colors"
          >
            Cancel
          </button>
          <div className="h-6 w-px bg-slate-200" />
          <button
            onClick={onToggleWallMode}
            className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              isWallMode
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
            title="Auto-Stud (W)"
          >
            Auto-Stud
          </button>
        </>
      ) : (
        <>
          <button
            onClick={onToggleComponentLibrary}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              showComponentLibrary
                ? 'bg-violet-500 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Components
          </button>

          <button
            onClick={onToggleWallMode}
            className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              isWallMode
                ? 'bg-amber-500 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
            title="Auto-Stud (W)"
          >
            Auto-Stud
          </button>
        </>
      )}

      <div className="h-6 w-px bg-slate-200" />
      <button
        onClick={onToggleMeasure}
        className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
          isMeasuring
            ? 'bg-red-500 text-white shadow-sm'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        }`}
        title="Measure (M)"
      >
        Measure
      </button>

      <div className="flex-1" />

      <button
        onClick={importProject}
        className="px-3 py-1.5 text-sm font-medium rounded-lg transition-colors bg-slate-100 text-slate-600 hover:bg-slate-200"
        title="Import project"
      >
        Import
      </button>

      <button
        onClick={() => exportProject(project, state.componentLibrary)}
        className="px-3 py-1.5 text-sm font-medium rounded-lg transition-colors bg-slate-100 text-slate-600 hover:bg-slate-200"
        title="Export project"
      >
        Export
      </button>

      <div className="h-6 w-px bg-slate-200" />

      <div className="flex items-center gap-2">
        <span className="text-slate-400 text-sm">Units:</span>
        {(['feet', 'inches', 'metric'] as const).map((unit) => (
          <button
            key={unit}
            onClick={() => setUnitSystem(unit)}
            className={`px-3 py-1 text-sm rounded-lg transition-colors ${
              project.unitSystem === unit
                ? 'bg-blue-500 text-white shadow-sm'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            {unit === 'feet' ? 'ft' : unit === 'inches' ? 'in' : 'cm'}
          </button>
        ))}

        <div className="h-6 w-px bg-slate-200" />

        <button
          onClick={toggleSnap}
          className={`px-3 py-1 text-sm rounded-lg transition-colors ${
            state.snapEnabled
              ? 'bg-blue-500 text-white shadow-sm'
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
          }`}
        >
          Snap
        </button>
      </div>
    </div>
  );
}
