import { useRef, useState, useMemo } from 'react';
import { ThreeEvent, useThree } from '@react-three/fiber';
import { Mesh, Vector3, BoxGeometry, Plane } from 'three';
import { Box } from '../../types';
import { getMaterialColor } from '../../core/materials';
import type { CameraView } from './Viewport';

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
}

export function Box3D({ box, allBoxes, isSelected, selectedBoxIds, cameraView, isMeasuring, onToggleSelect, onSelectGroup, onToggleSelectGroup, onMove, onMoveSelected, snap, onShowToast, pointerCapturedByBox, onHistoryBatchStart, onHistoryBatchEnd }: Box3DProps) {
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

  const edgeGeometry = useMemo(() => {
    return new BoxGeometry(
      box.dimensions.width,
      box.dimensions.height,
      box.dimensions.depth
    );
  }, [box.dimensions.width, box.dimensions.height, box.dimensions.depth]);

  // Get all box IDs in the same group as this box
  const groupMemberIds = box.groupId
    ? allBoxes.filter((b) => b.groupId === box.groupId).map((b) => b.id)
    : [box.id];

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    // In measure mode, let clicks propagate to the viewport's measure handler
    if (isMeasuring) return;
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
        onPointerLeave={() => { handlePointerUp(); if (!isMeasuring) document.body.style.cursor = 'default'; }}
        onPointerEnter={() => { if (!isMeasuring && !box.locked) document.body.style.cursor = 'move'; }}
        onClick={(e: ThreeEvent<MouseEvent>) => { if (!isMeasuring) e.stopPropagation(); }}
      >
        <boxGeometry
          args={[box.dimensions.width, box.dimensions.height, box.dimensions.depth]}
        />
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

    </group>
  );
}
