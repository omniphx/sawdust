import { useRef, useState, useMemo, useCallback } from 'react';
import { ThreeEvent, useThree, useFrame } from '@react-three/fiber';
import { Mesh, Vector3, BoxGeometry, Plane, BufferGeometry } from 'three';
import { Geometry, Base, Subtraction, Intersection, CSGGeometryRef } from '@react-three/csg';
import { Box, CutFace } from '../../types';
import { getMaterialColor } from '../../core/materials';
import { buildCutterProps } from '../../core/cuts';
import { useCutFaceHover } from '../../store/cutFaceHoverContext';
import type { CameraView } from './Viewport';

// Face highlight geometry config (positions relative to box corner origin)
const FACE_HIGHLIGHT: Record<CutFace, (w: number, h: number, d: number) => {
  position: [number, number, number];
  rotation: [number, number, number];
  size: [number, number];
}> = {
  left:   (_w, h, d) => ({ position: [0,   h/2, d/2], rotation: [0, Math.PI/2, 0],  size: [d, h] }),
  right:  (w,  h, d) => ({ position: [w,   h/2, d/2], rotation: [0, Math.PI/2, 0],  size: [d, h] }),
  top:    (w,  h, d) => ({ position: [w/2, h,   d/2], rotation: [-Math.PI/2, 0, 0], size: [w, d] }),
  bottom: (w, _h, d) => ({ position: [w/2, 0,   d/2], rotation: [Math.PI/2, 0, 0],  size: [w, d] }),
  front:  (w,  h, d) => ({ position: [w/2, h/2, d],   rotation: [0, 0, 0],           size: [w, h] }),
  back:   (w,  h, _d) => ({ position: [w/2, h/2, 0],   rotation: [0, 0, 0],          size: [w, h] }),
};

// Per-view drag config: which plane to drag on and which axis stays fixed
const DRAG_PLANE_CONFIG: Record<CameraView, { normal: [number, number, number]; fixedAxis: 'x' | 'y' | 'z' }> = {
  iso:    { normal: [0, 1, 0], fixedAxis: 'y' },
  top:    { normal: [0, 1, 0], fixedAxis: 'y' },
  front:  { normal: [0, 0, 1], fixedAxis: 'z' },
  back:   { normal: [0, 0, 1], fixedAxis: 'z' },
  left:   { normal: [1, 0, 0], fixedAxis: 'x' },
  right:  { normal: [1, 0, 0], fixedAxis: 'x' },
  custom: { normal: [0, 1, 0], fixedAxis: 'y' },
};

interface Box3DProps {
  box: Box;
  allBoxes: Box[];
  isSelected: boolean;
  selectedBoxIds: string[];
  cameraView: CameraView;
  isMeasuring?: boolean;
  isWallMode?: boolean;
  onToggleSelect: (id: string) => void;
  onSelectGroup: (ids: string[]) => void;
  onToggleSelectGroup: (ids: string[]) => void;
  onMove: (id: string, position: { x: number; y: number; z: number }) => void;
  onMoveSelected: (updates: Array<{ id: string; position: { x: number; y: number; z: number } }>) => void;
  snap: (v: number) => number;
  onShowToast: (message: string) => void;
  pointerCapturedByBox: React.MutableRefObject<boolean>;
  onHistoryBatchStart: () => void;
  onHistoryBatchEnd: () => void;
  onWallFaceHover?: (box: Box, faceNormal: { x: number; y: number; z: number }) => void;
  onWallFaceClear?: () => void;
  onWallFaceClick?: (box: Box, faceNormal: { x: number; y: number; z: number }) => void;
}

export function Box3D({ box, allBoxes, isSelected, selectedBoxIds, cameraView, isMeasuring, isWallMode, onToggleSelect, onSelectGroup, onToggleSelectGroup, onMove, onMoveSelected, snap, onShowToast, pointerCapturedByBox, onHistoryBatchStart, onHistoryBatchEnd, onWallFaceHover, onWallFaceClear, onWallFaceClick }: Box3DProps) {
  const meshRef = useRef<Mesh>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(new Vector3());
  const dragPlaneY = useRef(0);
  const dragPlaneRef = useRef(new Plane());
  const dragViewRef = useRef<CameraView>(cameraView);
  const dragStartPositions = useRef<Map<string, { x: number; y: number; z: number }>>(new Map());
  const didDrag = useRef(false);
  const wasMultiSelected = useRef(false);
  const pointerDownShift = useRef(false);
  const { camera, raycaster, pointer } = useThree();

  const color = getMaterialColor(box.materialId);
  const { hoveredCutFace } = useCutFaceHover();
  const highlightFace = hoveredCutFace?.boxId === box.id ? hoveredCutFace.face : null;

  const hasCuts = (box.cuts?.length ?? 0) > 0;
  const csgRef = useRef<CSGGeometryRef>(null);
  const [csgEdgeGeometry, setCsgEdgeGeometry] = useState<BufferGeometry | null>(null);
  const csgNeedsEdgeUpdate = useRef(false);

  // After CSG updates, capture the resulting geometry for edge rendering
  const handleCsgRef = useCallback((ref: CSGGeometryRef | null) => {
    (csgRef as React.MutableRefObject<CSGGeometryRef | null>).current = ref;
    if (ref) csgNeedsEdgeUpdate.current = true;
  }, []);

  // Poll for CSG geometry on next frame after ref is set
  useFrame(() => {
    if (csgNeedsEdgeUpdate.current && csgRef.current?.geometry) {
      const geo = csgRef.current.geometry;
      if (geo.attributes.position) {
        setCsgEdgeGeometry(geo.clone());
        csgNeedsEdgeUpdate.current = false;
      }
    }
  });

  // Trigger edge update when cuts change
  const cutsKey = JSON.stringify(box.cuts ?? []);
  useMemo(() => {
    if (hasCuts) {
      csgNeedsEdgeUpdate.current = true;
      // Clear stale edge geometry so it refreshes
      setCsgEdgeGeometry(null);
    } else {
      setCsgEdgeGeometry(null);
    }
  }, [cutsKey, hasCuts, box.dimensions.width, box.dimensions.height, box.dimensions.depth]);

  const edgeGeometry = useMemo(() => {
    if (csgEdgeGeometry) return csgEdgeGeometry;
    return new BoxGeometry(
      box.dimensions.width,
      box.dimensions.height,
      box.dimensions.depth
    );
  }, [box.dimensions.width, box.dimensions.height, box.dimensions.depth, csgEdgeGeometry]);

  // Get all box IDs in the same group as this box
  const groupMemberIds = box.groupId
    ? allBoxes.filter((b) => b.groupId === box.groupId).map((b) => b.id)
    : [box.id];

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    // In measure mode, let clicks propagate to the viewport's measure handler
    if (isMeasuring) return;
    // In wall mode, face click is handled via onClick
    if (isWallMode) return;
    e.stopPropagation();
    pointerCapturedByBox.current = true;
    if (e.shiftKey) {
      // Toggle entire group in/out of selection
      if (box.groupId) {
        onToggleSelectGroup(groupMemberIds);
      } else {
        onToggleSelect(box.id);
      }
    } else if (!isSelected) {
      // Select entire group
      onSelectGroup(groupMemberIds);
    }

    // If this box is locked, show warning and don't start drag
    if (box.locked) {
      onShowToast('Cannot move locked item');
      didDrag.current = false;
      wasMultiSelected.current = isSelected && selectedBoxIds.length > 1;
      pointerDownShift.current = e.shiftKey;
      return;
    }

    // Lock drag plane based on current camera view
    const config = DRAG_PLANE_CONFIG[cameraView];
    dragPlaneY.current = box.position[config.fixedAxis];
    dragViewRef.current = cameraView;

    dragPlaneRef.current.set(
      new Vector3(...config.normal),
      -dragPlaneY.current
    );
    raycaster.setFromCamera(pointer, camera);
    const intersectPoint = new Vector3();
    const hit = raycaster.ray.intersectPlane(dragPlaneRef.current, intersectPoint);

    if (!hit) {
      // Ray is parallel to drag plane — skip drag
      return;
    }

    // Compute offset on the two movable axes, zero on the fixed axis
    const offset = new Vector3(
      box.position.x - intersectPoint.x,
      box.position.y - intersectPoint.y,
      box.position.z - intersectPoint.z,
    );
    // Zero out the fixed axis so it doesn't accumulate drift
    offset[config.fixedAxis] = 0;
    setDragOffset(offset);

    // Track drag state for click-vs-drag detection
    didDrag.current = false;
    wasMultiSelected.current = isSelected && selectedBoxIds.length > 1;
    pointerDownShift.current = e.shiftKey;

    // Record initial positions of all boxes that should move together
    // Exclude locked boxes — they stay put
    const positions = new Map<string, { x: number; y: number; z: number }>();
    const activeSelectedIds = isSelected || !e.shiftKey
      ? (isSelected ? selectedBoxIds : [box.id])
      : selectedBoxIds;
    // Merge selected IDs with group member IDs so entire group moves together
    const allDragIds = new Set(activeSelectedIds);
    if (box.groupId) {
      for (const id of groupMemberIds) {
        allDragIds.add(id);
      }
    }
    for (const b of allBoxes) {
      if (allDragIds.has(b.id) && !b.locked) {
        positions.set(b.id, { ...b.position });
      }
    }
    dragStartPositions.current = positions;

    onHistoryBatchStart();
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (isWallMode && !isDragging) {
      const face = e.face;
      if (face) {
        const n = face.normal;
        // Skip top/bottom faces (Y normals)
        if (Math.abs(n.y) < 0.5) {
          const clamped = {
            x: Math.round(n.x),
            y: Math.round(n.y),
            z: Math.round(n.z),
          };
          onWallFaceHover?.(box, clamped);
        }
      }
      return;
    }
    if (!isDragging) return;
    e.stopPropagation();

    // Use the same plane and config from when drag started
    const config = DRAG_PLANE_CONFIG[dragViewRef.current];
    raycaster.setFromCamera(pointer, camera);
    const intersectPoint = new Vector3();
    const hit = raycaster.ray.intersectPlane(dragPlaneRef.current, intersectPoint);

    if (!hit) return;

    // Build new position: snap movable axes, keep fixed axis from original
    const raw = {
      x: intersectPoint.x + dragOffset.x,
      y: intersectPoint.y + dragOffset.y,
      z: intersectPoint.z + dragOffset.z,
    };
    const newPos = {
      x: config.fixedAxis === 'x' ? box.position.x : snap(raw.x),
      y: config.fixedAxis === 'y' ? box.position.y : snap(raw.y),
      z: config.fixedAxis === 'z' ? box.position.z : snap(raw.z),
    };

    didDrag.current = true;
    const draggedStartPos = dragStartPositions.current.get(box.id);
    const isMultiDrag = dragStartPositions.current.size > 1 && draggedStartPos;

    if (isMultiDrag) {
      const delta = {
        x: newPos.x - draggedStartPos.x,
        y: newPos.y - draggedStartPos.y,
        z: newPos.z - draggedStartPos.z,
      };
      // Zero delta on fixed axis
      delta[config.fixedAxis] = 0;

      const updates: Array<{ id: string; position: { x: number; y: number; z: number } }> = [];

      for (const [id, startPos] of dragStartPositions.current) {
        updates.push({
          id,
          position: {
            x: startPos.x + delta.x,
            y: startPos.y + delta.y,
            z: startPos.z + delta.z,
          },
        });
      }

      onMoveSelected(updates);
    } else {
      onMove(box.id, newPos);
    }
  };

  const handlePointerUp = () => {
    pointerCapturedByBox.current = false;
    // If we clicked on an already-selected box in a multi-selection without dragging,
    // replace the selection with just this group (or single box)
    if (!didDrag.current && wasMultiSelected.current && !pointerDownShift.current) {
      onSelectGroup(groupMemberIds);
    }
    if (isDragging) {
      onHistoryBatchEnd();
    }
    setIsDragging(false);
  };

  // Offset to render the mesh so that box.position = bottom-left-front corner
  const offsetX = box.dimensions.width / 2;
  const offsetY = box.dimensions.height / 2;
  const offsetZ = box.dimensions.depth / 2;

  return (
    <group
      position={[box.position.x, box.position.y, box.position.z]}
      rotation={[box.rotation.x, box.rotation.y, box.rotation.z]}
    >
      <mesh
        ref={meshRef}
        position={[offsetX, offsetY, offsetZ]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          if (isWallMode) { onWallFaceClear?.(); return; }
          handlePointerUp();
          if (!isMeasuring) document.body.style.cursor = 'default';
        }}
        onPointerEnter={() => {
          if (isWallMode || isMeasuring) return;
          if (!box.locked) document.body.style.cursor = 'move';
        }}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          if (isWallMode) {
            e.stopPropagation();
            const face = e.face;
            if (face) {
              const n = face.normal;
              if (Math.abs(n.y) < 0.5) {
                const clamped = { x: Math.round(n.x), y: Math.round(n.y), z: Math.round(n.z) };
                onWallFaceClick?.(box, clamped);
              }
            }
            return;
          }
          if (!isMeasuring) e.stopPropagation();
        }}
      >
        {hasCuts ? (
          <Geometry key={cutsKey} ref={handleCsgRef}>
            <Base>
              <boxGeometry args={[box.dimensions.width, box.dimensions.height, box.dimensions.depth]} />
            </Base>
            {box.cuts!.map((cut) => {
              const props = buildCutterProps(box.dimensions, cut);
              return (
                <Subtraction key={cut.id} position={props.position} rotation={props.rotation}>
                  <boxGeometry args={[props.cutterSize, props.cutterSize, props.cutterSize]} />
                </Subtraction>
              );
            })}
          </Geometry>
        ) : (
          <boxGeometry
            args={[box.dimensions.width, box.dimensions.height, box.dimensions.depth]}
          />
        )}
        <meshLambertMaterial
          color={color}
          emissive={isSelected ? '#3b82f6' : '#000000'}
          emissiveIntensity={isSelected ? 0.2 : 0}
          transparent={isSelected || !!box.hidden}
          opacity={box.hidden ? 0.15 : isSelected ? 0.85 : 1}
        />
      </mesh>

      {/* Edge outlines for shape definition */}
      <lineSegments position={[offsetX, offsetY, offsetZ]}>
        <edgesGeometry args={[edgeGeometry]} />
        <lineBasicMaterial
          color={isSelected ? '#3b82f6' : '#00000040'}
          linewidth={2}
          transparent={!!box.hidden}
          opacity={box.hidden ? 0.15 : 1}
        />
      </lineSegments>

      {/* Cut volume visualization — removed material shown in red */}
      {box.cuts?.map((cut) => {
        const props = buildCutterProps(box.dimensions, cut);
        return (
          <mesh key={`cutviz-${cut.id}`} position={[offsetX, offsetY, offsetZ]}>
            <Geometry>
              <Base>
                <boxGeometry args={[box.dimensions.width, box.dimensions.height, box.dimensions.depth]} />
              </Base>
              <Intersection position={props.position} rotation={props.rotation}>
                <boxGeometry args={[props.cutterSize, props.cutterSize, props.cutterSize]} />
              </Intersection>
            </Geometry>
            <meshBasicMaterial color="#ef4444" transparent opacity={0.45} depthWrite={false} />
          </mesh>
        );
      })}

      {/* Cut face highlight — shown when a cut's face selector is focused */}
      {highlightFace && (() => {
        const { width: w, height: h, depth: d } = box.dimensions;
        const cfg = FACE_HIGHLIGHT[highlightFace](w, h, d);
        return (
          <mesh position={cfg.position} rotation={cfg.rotation}>
            <planeGeometry args={cfg.size} />
            <meshBasicMaterial color="#3b82f6" transparent opacity={0.35} depthWrite={false} />
          </mesh>
        );
      })()}

    </group>
  );
}
