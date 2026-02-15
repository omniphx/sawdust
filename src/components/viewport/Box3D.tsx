import { useRef, useState, useMemo } from 'react';
import { ThreeEvent, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Mesh, Vector3, BoxGeometry } from 'three';
import { Box } from '../../types';
import { getMaterialColor } from '../../core/materials';

function groupIdToColor(groupId: string): string {
  let hash = 0;
  for (let i = 0; i < groupId.length; i++) {
    hash = (hash * 31 + groupId.charCodeAt(i)) | 0;
  }
  const hue = ((hash % 360) + 360) % 360;
  return `hsl(${hue}, 80%, 50%)`;
}

interface Box3DProps {
  box: Box;
  allBoxes: Box[];
  isSelected: boolean;
  selectedBoxIds: string[];
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

export function Box3D({ box, allBoxes, isSelected, selectedBoxIds, onToggleSelect, onSelectGroup, onToggleSelectGroup, onMove, onMoveSelected, snap, onShowToast, pointerCapturedByBox, onHistoryBatchStart, onHistoryBatchEnd }: Box3DProps) {
  const meshRef = useRef<Mesh>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(new Vector3());
  const dragPlaneY = useRef(0);
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

    // Lock drag plane to current Y so stacking doesn't shift the plane
    dragPlaneY.current = box.position.y;

    const groundPlane = new Vector3(0, 1, 0);
    raycaster.setFromCamera(pointer, camera);
    const intersectPoint = new Vector3();
    raycaster.ray.intersectPlane(
      { normal: groundPlane, constant: -dragPlaneY.current } as never,
      intersectPoint
    );

    setDragOffset(
      new Vector3(
        box.position.x - intersectPoint.x,
        0,
        box.position.z - intersectPoint.z
      )
    );

    // Track drag state for click-vs-drag detection
    didDrag.current = false;
    wasMultiSelected.current = isSelected && selectedBoxIds.length > 1;
    pointerDownShift.current = e.shiftKey;

    // Record initial positions of all selected boxes for multi-drag
    // Exclude locked boxes — they stay put
    const positions = new Map<string, { x: number; y: number; z: number }>();
    const activeSelectedIds = isSelected || !e.shiftKey
      ? (isSelected ? selectedBoxIds : [box.id])
      : selectedBoxIds;
    for (const b of allBoxes) {
      if (activeSelectedIds.includes(b.id) && !b.locked) {
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

    const groundPlane = new Vector3(0, 1, 0);
    raycaster.setFromCamera(pointer, camera);
    const intersectPoint = new Vector3();
    raycaster.ray.intersectPlane(
      { normal: groundPlane, constant: -dragPlaneY.current } as never,
      intersectPoint
    );

    const newX = snap(intersectPoint.x + dragOffset.x);
    const newZ = snap(intersectPoint.z + dragOffset.z);

    didDrag.current = true;
    const draggedStartPos = dragStartPositions.current.get(box.id);
    const isMultiDrag = dragStartPositions.current.size > 1 && draggedStartPos;

    if (isMultiDrag) {
      // Compute delta from dragged box's start position
      const deltaX = newX - draggedStartPos.x;
      const deltaZ = newZ - draggedStartPos.z;

      const updates: Array<{ id: string; position: { x: number; y: number; z: number } }> = [];

      for (const [id, startPos] of dragStartPositions.current) {
        const movedX = startPos.x + deltaX;
        const movedZ = startPos.z + deltaZ;

        // Keep Y at pre-drag position
        updates.push({ id, position: { x: movedX, y: startPos.y, z: movedZ } });
      }

      onMoveSelected(updates);
    } else {
      // Single box drag — keep Y at pre-drag position
      onMove(box.id, { x: newX, y: box.position.y, z: newZ });
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
      rotation={[0, 0, 0]}
    >
      <mesh
        ref={meshRef}
        position={[offsetX, offsetY, offsetZ]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onClick={(e: ThreeEvent<MouseEvent>) => e.stopPropagation()}
      >
        <boxGeometry
          args={[box.dimensions.width, box.dimensions.height, box.dimensions.depth]}
        />
        <meshLambertMaterial
          color={color}
          emissive={isSelected ? '#3b82f6' : '#000000'}
          emissiveIntensity={isSelected ? 0.2 : 0}
          transparent={isSelected}
          opacity={isSelected ? 0.85 : 1}
        />
      </mesh>

      {/* Edge outlines for shape definition */}
      <lineSegments position={[offsetX, offsetY, offsetZ]}>
        <edgesGeometry args={[edgeGeometry]} />
        <lineBasicMaterial
          color={isSelected ? '#3b82f6' : '#00000040'}
          linewidth={2}
        />
      </lineSegments>

      {/* Group indicator: colored outline slightly scaled up */}
      {box.groupId && (
        <lineSegments position={[offsetX, offsetY, offsetZ]} scale={[1.03, 1.03, 1.03]}>
          <edgesGeometry args={[edgeGeometry]} />
          <lineBasicMaterial
            color={groupIdToColor(box.groupId)}
            linewidth={2}
          />
        </lineSegments>
      )}

      {/* Lock icon overlay */}
      {box.locked && (
        <Html
          position={[box.dimensions.width, box.dimensions.height, 0]}
          style={{ pointerEvents: 'none' }}
          center
        >
          <div style={{
            fontSize: '14px',
            lineHeight: 1,
            background: 'rgba(245, 158, 11, 0.85)',
            borderRadius: '4px',
            padding: '2px 4px',
            color: 'white',
            userSelect: 'none',
            whiteSpace: 'nowrap',
          }}>
            🔒
          </div>
        </Html>
      )}
    </group>
  );
}
