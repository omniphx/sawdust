import { useRef, useEffect, useCallback, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Vector3, OrthographicCamera } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { IsometricCamera } from './IsometricCamera';
import { Grid } from './Grid';
import { Box3D } from './Box3D';
import { useProjectStore } from '../../store/projectStore';
import { snapToGrid } from '../../core/units';
import { Box } from '../../types';

const MIN_ZOOM = 20;
const MAX_ZOOM = 500;
const DRAG_THRESHOLD = 5; // pixels

function CameraExposer({ cameraRef }: { cameraRef: React.MutableRefObject<OrthographicCamera | null> }) {
  const { camera } = useThree();
  useEffect(() => {
    cameraRef.current = camera as OrthographicCamera;
  }, [camera, cameraRef]);
  return null;
}

interface MarqueeRect {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

function getMarqueeBounds(marquee: MarqueeRect) {
  return {
    left: Math.min(marquee.startX, marquee.currentX),
    top: Math.min(marquee.startY, marquee.currentY),
    right: Math.max(marquee.startX, marquee.currentX),
    bottom: Math.max(marquee.startY, marquee.currentY),
  };
}


function getBoxScreenBounds(
  box: Box,
  camera: OrthographicCamera,
  container: HTMLElement
): { left: number; top: number; right: number; bottom: number } {
  const rect = container.getBoundingClientRect();
  const { x: px, y: py, z: pz } = box.position;
  const { width: w, height: h, depth: d } = box.dimensions;

  // Project all 8 corners of the box's bounding box
  const corners = [
    new Vector3(px, py, pz),
    new Vector3(px + w, py, pz),
    new Vector3(px, py + h, pz),
    new Vector3(px + w, py + h, pz),
    new Vector3(px, py, pz + d),
    new Vector3(px + w, py, pz + d),
    new Vector3(px, py + h, pz + d),
    new Vector3(px + w, py + h, pz + d),
  ];

  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;

  for (const corner of corners) {
    corner.project(camera);
    const sx = ((corner.x + 1) / 2) * rect.width;
    const sy = ((-corner.y + 1) / 2) * rect.height;
    if (sx < left) left = sx;
    if (sx > right) right = sx;
    if (sy < top) top = sy;
    if (sy > bottom) bottom = sy;
  }

  return { left, top, right, bottom };
}

function TrackpadHandler({ controlsRef }: { controlsRef: React.RefObject<OrbitControlsImpl | null> }) {
  const { camera, gl } = useThree();

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();

    if (e.ctrlKey || e.metaKey) {
      // Pinch gesture → zoom
      const zoomFactor = 1 - e.deltaY * 0.01;
      camera.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, camera.zoom * zoomFactor));
      camera.updateProjectionMatrix();
    } else {
      // Two-finger scroll → pan
      const panSpeed = 1 / camera.zoom;
      const right = new Vector3();
      const up = new Vector3();
      camera.matrix.extractBasis(right, up, new Vector3());

      const offset = new Vector3()
        .addScaledVector(right, e.deltaX * panSpeed)
        .addScaledVector(up, -e.deltaY * panSpeed);

      camera.position.add(offset);
      if (controlsRef.current) {
        controlsRef.current.target.add(offset);
        controlsRef.current.update();
      }
    }
  }, [camera, controlsRef, gl]);

  useEffect(() => {
    const canvas = gl.domElement;
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [gl, handleWheel]);

  return null;
}

export function Viewport() {
  const { state, selectBoxes, toggleBoxSelection, updateBox, showToast, historyBatchStart, historyBatchEnd } = useProjectStore();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const cameraRef = useRef<OrthographicCamera | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [marquee, setMarquee] = useState<MarqueeRect | null>(null);
  const marqueeActive = useRef(false);
  const shiftHeld = useRef(false);
  const pointerCapturedByBox = useRef(false);

  const activeBoxes = state.mode === 'component-builder'
    ? (state.currentTemplate?.boxes ?? [])
    : state.project.boxes;

  const handleMove = (id: string, position: { x: number; y: number; z: number }) => {
    updateBox(id, { position });
  };

  const handleMoveSelected = (updates: Array<{ id: string; position: { x: number; y: number; z: number } }>) => {
    for (const { id, position } of updates) {
      updateBox(id, { position });
    }
  };

  const snap = useCallback(
    (v: number) => state.snapEnabled ? snapToGrid(v, state.project.unitSystem) : v,
    [state.project.unitSystem, state.snapEnabled]
  );

  const handleBackgroundClick = () => {
    // Only deselect if not in a marquee drag (marquee handles its own selection)
    if (!marqueeActive.current) {
      selectBoxes([]);
    }
  };

  const handleMarqueeMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Only start marquee on left click, and only on the container itself (not on UI overlays)
    if (e.button !== 0) return;
    // If a box captured the pointer (R3F event fired first), skip marquee
    if (pointerCapturedByBox.current) return;
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    shiftHeld.current = e.shiftKey;
    setMarquee({ startX: x, startY: y, currentX: x, currentY: y });
    marqueeActive.current = false;
  }, []);

  const handleMarqueeMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    setMarquee((prev) => {
      if (!prev) return null;
      const container = containerRef.current;
      if (!container) return prev;

      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const dx = Math.abs(x - prev.startX);
      const dy = Math.abs(y - prev.startY);

      if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
        marqueeActive.current = true;
      }

      return { ...prev, currentX: x, currentY: y };
    });
  }, []);

  const handleMarqueeMouseUp = useCallback(() => {
    if (!marquee) return;

    if (marqueeActive.current && cameraRef.current && containerRef.current) {
      const bounds = getMarqueeBounds(marquee);
      const camera = cameraRef.current;
      const container = containerRef.current;

      const hitIds: string[] = [];
      for (const box of activeBoxes) {
        const boxBounds = getBoxScreenBounds(box, camera, container);
        // AABB intersection test
        if (
          bounds.left <= boxBounds.right &&
          bounds.right >= boxBounds.left &&
          bounds.top <= boxBounds.bottom &&
          bounds.bottom >= boxBounds.top
        ) {
          hitIds.push(box.id);
        }
      }

      if (shiftHeld.current) {
        // Add to existing selection
        const currentIds = new Set(state.selectedBoxIds);
        for (const id of hitIds) {
          if (currentIds.has(id)) {
            currentIds.delete(id);
          } else {
            currentIds.add(id);
          }
        }
        selectBoxes(Array.from(currentIds));
      } else {
        selectBoxes(hitIds);
      }
    }
    // If not a drag (small movement), the background click handler in R3F will handle deselect

    setMarquee(null);
    marqueeActive.current = false;
  }, [marquee, activeBoxes, state.selectedBoxIds, selectBoxes]);

  const marqueeStyle = marquee && marqueeActive.current
    ? {
        left: Math.min(marquee.startX, marquee.currentX),
        top: Math.min(marquee.startY, marquee.currentY),
        width: Math.abs(marquee.currentX - marquee.startX),
        height: Math.abs(marquee.currentY - marquee.startY),
      }
    : null;

  return (
    <div
      ref={containerRef}
      className="flex-1 bg-sky-50 relative"
      onMouseDown={handleMarqueeMouseDown}
      onMouseMove={handleMarqueeMouseMove}
      onMouseUp={handleMarqueeMouseUp}
    >
      {marqueeStyle && (
        <div
          className="absolute pointer-events-none border border-blue-500 bg-blue-500/20 z-10"
          style={marqueeStyle}
        />
      )}
      <Canvas>
        <CameraExposer cameraRef={cameraRef} />
        <IsometricCamera />
        <OrbitControls
          ref={controlsRef}
          enableRotate={false}
          enablePan={true}
          enableZoom={false}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
        />
        <TrackpadHandler controlsRef={controlsRef} />
        <hemisphereLight args={['#b0d0ff', '#806040', 0.6]} />
        <directionalLight position={[5, 12, 8]} intensity={1} />
        <directionalLight position={[-8, 6, -3]} intensity={0.25} />

        <Grid unitSystem={state.project.unitSystem} />

        <mesh
          position={[0, -0.01, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          onClick={handleBackgroundClick}
        >
          <planeGeometry args={[100, 100]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>

        {activeBoxes.map((box) => (
          <Box3D
            key={box.id}
            box={box}
            allBoxes={activeBoxes}
            isSelected={state.selectedBoxIds.includes(box.id)}
            selectedBoxIds={state.selectedBoxIds}
            onToggleSelect={(id: string) => toggleBoxSelection(id)}
            onSelectGroup={(ids: string[]) => selectBoxes(ids)}
            onToggleSelectGroup={(ids: string[]) => {
              const currentIds = new Set(state.selectedBoxIds);
              const allIn = ids.every((id) => currentIds.has(id));
              if (allIn) {
                // Remove all group members
                selectBoxes(state.selectedBoxIds.filter((id) => !ids.includes(id)));
              } else {
                // Add all group members
                const merged = new Set([...state.selectedBoxIds, ...ids]);
                selectBoxes(Array.from(merged));
              }
            }}
            onMove={handleMove}
            onMoveSelected={handleMoveSelected}
            snap={snap}
            onShowToast={showToast}
            pointerCapturedByBox={pointerCapturedByBox}
            onHistoryBatchStart={historyBatchStart}
            onHistoryBatchEnd={historyBatchEnd}
          />
        ))}
      </Canvas>
    </div>
  );
}
