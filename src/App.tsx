import { useState, useEffect } from 'react';
import { ProjectProvider, useProjectStore } from './store/projectStore';
import { Toolbar } from './components/layout/Toolbar';
import { Viewport } from './components/viewport/Viewport';
import { PropertiesPanel } from './components/layout/PropertiesPanel';
import { BOMPanel } from './components/layout/BOMPanel';
import { ComponentLibraryPanel } from './components/layout/ComponentLibraryPanel';
import { Toast } from './components/ui/Toast';

function AppContent() {
  const { state, copySelectedBoxes, pasteBoxes, duplicateSelectedBoxes, deleteSelectedBoxes, dismissToast, undo, redo, canUndo, canRedo } = useProjectStore();
  const [showComponentLibrary, setShowComponentLibrary] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when typing in an input
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.metaKey || e.ctrlKey) {
        if (e.key === 'z' && e.shiftKey) {
          e.preventDefault();
          if (canRedo) redo();
        } else if (e.key === 'z') {
          e.preventDefault();
          if (canUndo) undo();
        } else if (e.key === 'c' && state.selectedBoxIds.length > 0) {
          e.preventDefault();
          copySelectedBoxes();
        } else if (e.key === 'v' && state.clipboard && state.clipboard.length > 0) {
          e.preventDefault();
          pasteBoxes();
        } else if (e.key === 'd' && state.selectedBoxIds.length > 0) {
          e.preventDefault();
          duplicateSelectedBoxes();
        }
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedBoxIds.length > 0) {
        e.preventDefault();
        deleteSelectedBoxes();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.selectedBoxIds, state.clipboard, copySelectedBoxes, pasteBoxes, duplicateSelectedBoxes, deleteSelectedBoxes, undo, redo, canUndo, canRedo]);

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
      <Toast message={state.toastMessage} onDismiss={dismissToast} />
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
