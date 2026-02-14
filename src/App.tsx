import { useState, useEffect } from 'react';
import { ProjectProvider, useProjectStore } from './store/projectStore';
import { Toolbar } from './components/layout/Toolbar';
import { Viewport } from './components/viewport/Viewport';
import { PropertiesPanel } from './components/layout/PropertiesPanel';
import { BOMPanel } from './components/layout/BOMPanel';
import { ComponentLibraryPanel } from './components/layout/ComponentLibraryPanel';

function AppContent() {
  const { state, copyBox, pasteBox, duplicateBox } = useProjectStore();
  const [showComponentLibrary, setShowComponentLibrary] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when typing in an input
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.metaKey || e.ctrlKey) {
        if (e.key === 'c' && state.selectedBoxId) {
          e.preventDefault();
          copyBox(state.selectedBoxId);
        } else if (e.key === 'v' && state.clipboard) {
          e.preventDefault();
          pasteBox();
        } else if (e.key === 'd' && state.selectedBoxId) {
          e.preventDefault();
          duplicateBox(state.selectedBoxId);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.selectedBoxId, state.clipboard, copyBox, pasteBox, duplicateBox]);

  const isBuilderMode = state.mode === 'component-builder';

  return (
    <div className="h-screen flex flex-col bg-slate-100">
      <Toolbar
        onToggleComponentLibrary={() => setShowComponentLibrary((v) => !v)}
        showComponentLibrary={showComponentLibrary}
      />
      <div className="flex-1 flex overflow-hidden relative">
        <Viewport />
        <div className="absolute top-0 right-0 bottom-0 flex">
          <PropertiesPanel />
          {!isBuilderMode && showComponentLibrary && <ComponentLibraryPanel />}
          {!isBuilderMode && <BOMPanel />}
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <ProjectProvider>
      <AppContent />
    </ProjectProvider>
  );
}

export default App;
