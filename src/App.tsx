import { useState, useEffect } from 'react';
import { ProjectProvider, useProjectStore } from './store/projectStore';
import { Toolbar } from './components/layout/Toolbar';
import { Viewport } from './components/viewport/Viewport';
import { PropertiesPanel } from './components/layout/PropertiesPanel';
import { BOMPanel } from './components/layout/BOMPanel';
import { ComponentLibraryPanel } from './components/layout/ComponentLibraryPanel';
import { WallPanel } from './components/layout/WallPanel';
import { Toast } from './components/ui/Toast';
import { WallTargetFace, WallOpening } from './types/wall';
import { generateStudWall } from './core/studs';
import { v4 as uuid } from 'uuid';

function AppContent() {
  const { state, copySelectedBoxes, pasteBoxes, duplicateSelectedBoxes, deleteSelectedBoxes, dismissToast, undo, redo, canUndo, canRedo, groupSelectedBoxes, ungroupSelectedBoxes, addBoxes, deleteBox } = useProjectStore();
  const [showComponentLibrary, setShowComponentLibrary] = useState(false);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [isWallMode, setIsWallMode] = useState(false);
  const [wallTargetFace, setWallTargetFace] = useState<WallTargetFace | null>(null);

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
        } else if (e.key === 'g' && e.shiftKey) {
          e.preventDefault();
          ungroupSelectedBoxes();
        } else if (e.key === 'g') {
          e.preventDefault();
          groupSelectedBoxes();
        }
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedBoxIds.length > 0) {
        e.preventDefault();
        deleteSelectedBoxes();
      }

      if (e.key === 'm' || e.key === 'M') {
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          setIsMeasuring((v) => !v);
        }
      }

      if (e.key === 'w' || e.key === 'W') {
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          setIsWallMode((v) => !v);
          if (isWallMode) setWallTargetFace(null);
        }
      }

      if (e.key === 'Escape') {
        if (isMeasuring) {
          e.preventDefault();
          setIsMeasuring(false);
        }
        if (isWallMode) {
          e.preventDefault();
          setIsWallMode(false);
          setWallTargetFace(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.selectedBoxIds, state.clipboard, copySelectedBoxes, pasteBoxes, duplicateSelectedBoxes, deleteSelectedBoxes, undo, redo, canUndo, canRedo, groupSelectedBoxes, ungroupSelectedBoxes, isMeasuring, isWallMode]);

  const isBuilderMode = state.mode === 'component-builder';

  const handleWallFaceSelect = (face: WallTargetFace) => {
    setWallTargetFace(face);
  };

  const handleGenerateStuds = (
    studMaterialId: string,
    plateMaterialId: string,
    studSpacing: number,
    doubleTopPlate: boolean,
    openings: WallOpening[],
  ) => {
    if (!wallTargetFace) return;
    const groupId = uuid();
    const boxes = generateStudWall(
      wallTargetFace,
      studMaterialId,
      plateMaterialId,
      studSpacing,
      doubleTopPlate,
      openings,
      groupId,
    );
    addBoxes(boxes);
    deleteBox(wallTargetFace.sourceBoxId);
    setWallTargetFace(null);
    setIsWallMode(false);
  };

  const handleCancelWall = () => {
    setWallTargetFace(null);
    setIsWallMode(false);
  };

  return (
    <div className="h-screen flex flex-col bg-slate-100">
      <Toolbar
        onToggleComponentLibrary={() => setShowComponentLibrary((v) => !v)}
        showComponentLibrary={showComponentLibrary}
        isMeasuring={isMeasuring}
        onToggleMeasure={() => setIsMeasuring((v) => !v)}
        isWallMode={isWallMode}
        onToggleWallMode={() => {
          setIsWallMode((v) => !v);
          setWallTargetFace(null);
        }}
      />
      <div className="flex-1 flex overflow-hidden relative">
        <Viewport
          isMeasuring={isMeasuring}
          isWallMode={isWallMode}
          onWallFaceSelect={handleWallFaceSelect}
        />
        <div className="absolute top-0 right-0 bottom-0 flex">
          {wallTargetFace ? (
            <WallPanel
              target={wallTargetFace}
              onGenerate={handleGenerateStuds}
              onCancel={handleCancelWall}
            />
          ) : (
            <>
              <PropertiesPanel />
              {!isBuilderMode && showComponentLibrary && <ComponentLibraryPanel />}
              {!isBuilderMode && <BOMPanel />}
            </>
          )}
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
