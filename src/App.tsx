import { useState, useEffect } from 'react';
import { ProjectProvider, useProjectStore } from './store/projectStore';
import { CutFaceHoverProvider } from './store/cutFaceHoverContext';
import { Toolbar } from './components/layout/Toolbar';
import { Viewport } from './components/viewport/Viewport';
import { PropertiesPanel } from './components/layout/PropertiesPanel';
import { BOMPanel } from './components/layout/BOMPanel';
import { ComponentLibraryPanel } from './components/layout/ComponentLibraryPanel';
import { WallPanel } from './components/layout/WallPanel';
import { Toast } from './components/ui/Toast';
import { WallTargetFace, WallOpening } from './types/wall';
import { BetaMiterDraft } from './types';
import { generateStudWall } from './core/studs';
import { v4 as uuid } from 'uuid';

function AppContent() {
  const { state, copySelectedBoxes, pasteBoxes, duplicateSelectedBoxes, deleteSelectedBoxes, dismissToast, undo, redo, canUndo, canRedo, groupSelectedBoxes, ungroupSelectedBoxes, addBoxes, deleteBox } = useProjectStore();
  const [showComponentLibrary, setShowComponentLibrary] = useState(false);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [isWallMode, setIsWallMode] = useState(false);
  const [isMiterMode, setIsMiterMode] = useState(false);
  const [miterDraft, setMiterDraft] = useState<BetaMiterDraft | null>(null);
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
          setIsMeasuring((v) => {
            const next = !v;
            if (next) {
              setIsWallMode(false);
              setWallTargetFace(null);
              setIsMiterMode(false);
              setMiterDraft(null);
            }
            return next;
          });
        }
      }

      if (e.key === 'w' || e.key === 'W') {
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          setIsWallMode((v) => {
            const next = !v;
            if (next) {
              setIsMeasuring(false);
              setIsMiterMode(false);
              setMiterDraft(null);
            } else {
              setWallTargetFace(null);
            }
            return next;
          });
        }
      }

      if (e.key === 'b' || e.key === 'B') {
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          setIsMiterMode((v) => {
            const next = !v;
            if (next) {
              setIsMeasuring(false);
              setIsWallMode(false);
              setWallTargetFace(null);
            } else {
              setMiterDraft(null);
            }
            return next;
          });
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
        if (isMiterMode) {
          e.preventDefault();
          setIsMiterMode(false);
          setMiterDraft(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state.selectedBoxIds, state.clipboard, copySelectedBoxes, pasteBoxes, duplicateSelectedBoxes, deleteSelectedBoxes, undo, redo, canUndo, canRedo, groupSelectedBoxes, ungroupSelectedBoxes, isMeasuring, isWallMode, isMiterMode]);

  useEffect(() => {
    if (!miterDraft) return;
    if (state.selectedBoxIds.length !== 1 || state.selectedBoxIds[0] !== miterDraft.boxId) {
      setMiterDraft(null);
    }
  }, [state.selectedBoxIds, miterDraft]);

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
        onToggleMeasure={() => {
          setIsMeasuring((v) => {
            const next = !v;
            if (next) {
              setIsWallMode(false);
              setWallTargetFace(null);
              setIsMiterMode(false);
              setMiterDraft(null);
            }
            return next;
          });
        }}
        isWallMode={isWallMode}
        onToggleWallMode={() => {
          setIsWallMode((v) => {
            const next = !v;
            if (next) {
              setIsMeasuring(false);
              setIsMiterMode(false);
              setMiterDraft(null);
            } else {
              setWallTargetFace(null);
            }
            return next;
          });
        }}
      />
      <div className="flex-1 flex overflow-hidden relative">
        <Viewport
          isMeasuring={isMeasuring}
          isWallMode={isWallMode}
          isMiterMode={isMiterMode}
          miterDraft={miterDraft}
          onMiterEdgePick={setMiterDraft}
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
              <PropertiesPanel
                isMiterMode={isMiterMode}
                miterDraft={miterDraft}
                onMiterDraftChange={setMiterDraft}
                onToggleMiterMode={() => {
                  setIsMiterMode((v) => {
                    const next = !v;
                    if (next) {
                      setIsMeasuring(false);
                      setIsWallMode(false);
                      setWallTargetFace(null);
                    } else {
                      setMiterDraft(null);
                    }
                    return next;
                  });
                }}
              />
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
      <CutFaceHoverProvider>
        <AppContent />
      </CutFaceHoverProvider>
    </ProjectProvider>
  );
}

export default App;
