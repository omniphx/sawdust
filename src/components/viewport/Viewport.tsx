import { useRef, useEffect, useCallback, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Vector3, OrthographicCamera, Plane, Raycaster, Vector2, Euler, MOUSE } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { IsometricCamera } from './IsometricCamera';
import { Grid } from './Grid';
import { AxisGizmo } from './AxisGizmo';
import { Box3D } from './Box3D';
import { WallFaceHighlight } from './WallFaceHighlight';
import { MeasureOverlay } from './MeasureOverlay';
import { TriangleCalculator } from './TriangleCalculator';
import { useProjectStore } from '../../store/projectStore';
import { snapToGrid } from '../../core/units';
import { findNearestSnapPoint, measureDistance } from '../../core/measureSnap';
import { Box } from '../../types';
import { WallTargetFace } from '../../types/wall';

const MIN_ZOOM = 20;
const MAX_ZOOM = 1500;
const DRAG_THRESHOLD = 5; // pixels

export type CameraView = 'iso' | 'front' | 'back' | 'left' | 'right' | 'top' | 'custom';

const CAMERA_DISTANCE = 20;
const ISO_ANGLE = Math.PI * 5 / 4; // 225 degrees
const ISO_ELEVATION = Math.atan(1 / Math.sqrt(2)); // ~35.264 degrees

const VIEW_PRESETS: Record<CameraView, { position: [number, number, number]; up: [number, number, number] }> = {
  iso: {
    position: [
      CAMERA_DISTANCE * Math.cos(ISO_ELEVATION) * Math.sin(ISO_ANGLE),
      CAMERA_DISTANCE * Math.sin(ISO_ELEVATION),
      CAMERA_DISTANCE * Math.cos(ISO_ELEVATION) * Math.cos(ISO_ANGLE),
    ],
    up: [0, 1, 0],
  },
  front: { position: [0, 0, CAMERA_DISTANCE], up: [0, 1, 0] },
  back: { position: [0, 0, -CAMERA_DISTANCE], up: [0, 1, 0] },
  left: { position: [-CAMERA_DISTANCE, 0, 0], up: [0, 1, 0] },
  right: { position: [CAMERA_DISTANCE, 0, 0], up: [0, 1, 0] },
  top: { position: [0, CAMERA_DISTANCE, 0], up: [0, 0, -1] },
  custom: { position: [0, 0, 0], up: [0, 1, 0] }, // placeholder, not applied
};

// Labels use user-facing axis names
const VIEW_LABELS: Record<CameraView, string> = {
  iso: 'Iso',
  front: 'Front',
  back: 'Back',
  left: 'Left',
  right: 'Right',
  top: 'Top',
  custom: '',
};

// Preset views shown as buttons (excludes 'custom')
const PRESET_VIEWS: CameraView[] = ['iso', 'front', 'back', 'left', 'right', 'top'];

function CameraViewController({
  view,
  controlsRef,
}: {
  view: CameraView;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}) {
  const { camera } = useThree();
  const initializedRef = useRef(false);

  useEffect(() => {
    // Skip the first render — IsometricCamera sets up the initial position
    if (!initializedRef.current) {
      initializedRef.current = true;
      return;
    }

    // Custom view is user-controlled via orbit rotation; don't apply a preset
    if (view === 'custom') return;

    const preset = VIEW_PRESETS[view];
    const target = controlsRef.current?.target ?? new Vector3(0, 0, 0);

    camera.position.set(
      target.x + preset.position[0],
      target.y + preset.position[1],
      target.z + preset.position[2],
    );
    camera.up.set(...preset.up);
    camera.lookAt(target);
    camera.updateProjectionMatrix();

    if (controlsRef.current) {
      controlsRef.current.update();
    }
  }, [view, camera, controlsRef]);

  return null;
}

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

  // Local corners relative to position origin (before rotation)
  const localCorners = [
    new Vector3(0, 0, 0), new Vector3(w, 0, 0), new Vector3(0, h, 0), new Vector3(w, h, 0),
    new Vector3(0, 0, d), new Vector3(w, 0, d), new Vector3(0, h, d), new Vector3(w, h, d),
  ];

  // Apply full 3D Euler rotation around the position origin, then translate
  const euler = new Euler(box.rotation.x, box.rotation.y, box.rotation.z, 'XYZ');
  const corners = localCorners.map((v) => {
    v.applyEuler(euler);
    return new Vector3(px + v.x, py + v.y, pz + v.z);
  });

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

// Plane normals for measure raycasting per view
const MEASURE_PLANE_CONFIG: Record<CameraView, [number, number, number]> = {
  iso:    [0, 1, 0],
  top:    [0, 1, 0],
  front:  [0, 0, 1],
  back:   [0, 0, 1],
  left:   [1, 0, 0],
  right:  [1, 0, 0],
  custom: [0, 1, 0],
};

interface ViewportProps {
  isMeasuring?: boolean;
  isWallMode?: boolean;
  onWallFaceSelect?: (face: WallTargetFace) => void;
}

export function Viewport({ isMeasuring = false, isWallMode = false, onWallFaceSelect }: ViewportProps) {
  const { state, selectBoxes, toggleBoxSelection, updateBox, showToast, historyBatchStart, historyBatchEnd } = useProjectStore();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const cameraRef = useRef<OrthographicCamera | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [marquee, setMarquee] = useState<MarqueeRect | null>(null);
  const [cameraView, setCameraView] = useState<CameraView>('iso');
  const marqueeActive = useRef(false);
  const shiftHeld = useRef(false);
  const pointerCapturedByBox = useRef(false);

  // Measure tool state
  const [measurePointA, setMeasurePointA] = useState<Vector3 | null>(null);
  const [measurePointB, setMeasurePointB] = useState<Vector3 | null>(null);
  const [measureHover, setMeasureHover] = useState<Vector3 | null>(null);

  // Wall mode state
  const [hoveredWallFace, setHoveredWallFace] = useState<{ box: Box; faceNormal: { x: number; y: number; z: number } } | null>(null);

  const handleWallFaceHover = useCallback((box: Box, faceNormal: { x: number; y: number; z: number }) => {
    setHoveredWallFace({ box, faceNormal });
  }, []);

  const handleWallFaceClear = useCallback(() => {
    setHoveredWallFace(null);
  }, []);

  const handleWallFaceClick = useCallback((box: Box, faceNormal: { x: number; y: number; z: number }) => {
    // Determine faceAxis: if normal is along X, wall runs along Z; if normal is along Z, wall runs along X
    const faceAxis: 'x' | 'z' = faceNormal.x !== 0 ? 'z' : 'x';
    const face: WallTargetFace = {
      sourceBoxId: box.id,
      faceAxis,
      wallStartX: box.position.x,
      wallStartZ: box.position.z,
      wallY: box.position.y,
      wallLength: faceAxis === 'x' ? box.dimensions.width : box.dimensions.depth,
      wallHeight: box.dimensions.height,
      wallDepth: faceAxis === 'x' ? box.dimensions.depth : box.dimensions.width,
    };
    onWallFaceSelect?.(face);
  }, [onWallFaceSelect]);

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

  // Clear measurement when exiting measure mode
  useEffect(() => {
    if (!isMeasuring) {
      setMeasurePointA(null);
      setMeasurePointB(null);
      setMeasureHover(null);
    }
  }, [isMeasuring]);

  /** Raycast a screen-space mouse event to the view plane, returning the world point */
  const raycastToViewPlane = useCallback((clientX: number, clientY: number): Vector3 | null => {
    const camera = cameraRef.current;
    const container = containerRef.current;
    if (!camera || !container) return null;

    const rect = container.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;

    const normal = MEASURE_PLANE_CONFIG[cameraView];
    const plane = new Plane(new Vector3(...normal), 0);
    const raycaster = new Raycaster();
    raycaster.setFromCamera(new Vector2(ndcX, ndcY), camera);

    const intersect = new Vector3();
    const hit = raycaster.ray.intersectPlane(plane, intersect);
    return hit ? intersect : null;
  }, [cameraView]);

  const handleMeasureClick = useCallback((clientX: number, clientY: number) => {
    const worldPoint = raycastToViewPlane(clientX, clientY);
    if (!worldPoint) return;

    const camera = cameraRef.current;
    const container = containerRef.current;
    if (!camera || !container) return;

    const rect = container.getBoundingClientRect();
    const snapped = findNearestSnapPoint(worldPoint, activeBoxes, camera, rect.width, rect.height);
    const point = snapped ?? worldPoint;

    if (!measurePointA || measurePointB) {
      // Start new measurement
      setMeasurePointA(point);
      setMeasurePointB(null);
    } else {
      // Set second point
      setMeasurePointB(point);
    }
  }, [raycastToViewPlane, activeBoxes, measurePointA, measurePointB]);

  const handleMeasureHover = useCallback((clientX: number, clientY: number) => {
    if (measurePointB) {
      setMeasureHover(null);
      return;
    }

    const worldPoint = raycastToViewPlane(clientX, clientY);
    if (!worldPoint) return;

    const camera = cameraRef.current;
    const container = containerRef.current;
    if (!camera || !container) return;

    const rect = container.getBoundingClientRect();
    const snapped = findNearestSnapPoint(worldPoint, activeBoxes, camera, rect.width, rect.height);
    setMeasureHover(snapped ?? worldPoint);
  }, [raycastToViewPlane, activeBoxes, measurePointB]);

  const handleBackgroundClick = () => {
    // Only deselect if not in a marquee drag (marquee handles its own selection)
    if (!marqueeActive.current && !isMeasuring) {
      selectBoxes([]);
    }
  };

  const handleMarqueeMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Only start marquee on left click, and only on the container itself (not on UI overlays)
    if (e.button !== 0) return;
    // Suppress marquee in measure mode or wall mode
    if (isMeasuring) return;
    if (isWallMode) return;
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
  }, [isMeasuring, isWallMode]);

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
    // Delay resetting marqueeActive so the subsequent click event on the
    // background mesh still sees it as true and skips the deselect logic.
    requestAnimationFrame(() => {
      marqueeActive.current = false;
    });
  }, [marquee, activeBoxes, state.selectedBoxIds, selectBoxes]);

  const marqueeStyle = marquee && marqueeActive.current
    ? {
        left: Math.min(marquee.startX, marquee.currentX),
        top: Math.min(marquee.startY, marquee.currentY),
        width: Math.abs(marquee.currentX - marquee.startX),
        height: Math.abs(marquee.currentY - marquee.startY),
      }
    : null;

  const computedDistance = measurePointA && measurePointB
    ? measureDistance(measurePointA, measurePointB, cameraView)
    : null;

  return (
    <div
      ref={containerRef}
      className={`flex-1 bg-sky-50 relative ${isMeasuring || isWallMode ? 'cursor-crosshair' : ''}`}
      onContextMenu={(e) => e.preventDefault()}
      onMouseDown={handleMarqueeMouseDown}
      onMouseMove={(e) => {
        handleMarqueeMouseMove(e);
        if (isMeasuring) handleMeasureHover(e.clientX, e.clientY);
      }}
      onMouseUp={handleMarqueeMouseUp}
      onClick={(e) => {
        if (isMeasuring) handleMeasureClick(e.clientX, e.clientY);
      }}
    >
      {marqueeStyle && (
        <div
          className="absolute pointer-events-none border border-blue-500 bg-blue-500/20 z-10"
          style={marqueeStyle}
        />
      )}
      <div
        className="absolute bottom-4 left-4 z-10 flex flex-col gap-2 items-start"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <TriangleCalculator />
        <div className="flex gap-1">
          {PRESET_VIEWS.map((key) => (
            <button
              key={key}
              onClick={() => setCameraView(key)}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                cameraView === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
              }`}
            >
              {VIEW_LABELS[key]}
            </button>
          ))}
        </div>
      </div>
      <Canvas>
        <CameraExposer cameraRef={cameraRef} />
        <IsometricCamera />
        <CameraViewController view={cameraView} controlsRef={controlsRef} />
        <OrbitControls
          ref={controlsRef}
          enableRotate={true}
          enablePan={false}
          enableZoom={false}
          mouseButtons={{ RIGHT: MOUSE.ROTATE }}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          onStart={() => {
            if (cameraView !== 'custom') setCameraView('custom');
          }}
        />
        <TrackpadHandler controlsRef={controlsRef} />
        <hemisphereLight args={['#b0d0ff', '#806040', 0.6]} />
        <directionalLight position={[5, 12, 8]} intensity={1} />
        <directionalLight position={[-8, 6, -3]} intensity={0.25} />

        <Grid unitSystem={state.project.unitSystem} />
        <AxisGizmo />

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
            cameraView={cameraView}
            isMeasuring={isMeasuring}
            isWallMode={isWallMode}
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
            onWallFaceHover={handleWallFaceHover}
            onWallFaceClear={handleWallFaceClear}
            onWallFaceClick={handleWallFaceClick}
          />
        ))}

        {isWallMode && hoveredWallFace && (
          <WallFaceHighlight
            box={hoveredWallFace.box}
            faceNormal={hoveredWallFace.faceNormal}
          />
        )}

        {isMeasuring && (
          <MeasureOverlay
            pointA={measurePointA}
            pointB={measurePointB}
            hoverPoint={measureHover}
            distance={computedDistance}
            unitSystem={state.project.unitSystem}
          />
        )}
      </Canvas>
    </div>
  );
}
