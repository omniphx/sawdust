import { useRef, useState, useMemo } from 'react';
import { ThreeEvent, useThree } from '@react-three/fiber';
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
  onSelect: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onMove: (id: string, position: { x: number; y: number; z: number }) => void;
  onMoveSelected: (updates: Array<{ id: string; position: { x: number; y: number; z: number } }>) => void;
  snap: (v: number) => number;
}

export function Box3D({ box, allBoxes, isSelected, selectedBoxIds, onSelect, onToggleSelect, onMove, onMoveSelected, snap }: Box3DProps) {
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

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (e.shiftKey) {
      onToggleSelect(box.id);
    } else if (!isSelected) {
      onSelect(box.id);
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
    const positions = new Map<string, { x: number; y: number; z: number }>();
    const activeSelectedIds = isSelected || !e.shiftKey
      ? (isSelected ? selectedBoxIds : [box.id])
      : selectedBoxIds;
    for (const b of allBoxes) {
      if (activeSelectedIds.includes(b.id)) {
        positions.set(b.id, { ...b.position });
      }
    }
    dragStartPositions.current = positions;

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

      const draggedIds = new Set(dragStartPositions.current.keys());
      const updates: Array<{ id: string; position: { x: number; y: number; z: number } }> = [];

      for (const [id, startPos] of dragStartPositions.current) {
        const movedX = startPos.x + deltaX;
        const movedZ = startPos.z + deltaZ;

        // Find stacking Y for each box, excluding other dragged boxes
        let stackY = 0;
        const movingBox = allBoxes.find((b) => b.id === id);
        if (movingBox) {
          for (const other of allBoxes) {
            if (draggedIds.has(other.id)) continue;
            const overlapX =
              movedX < other.position.x + other.dimensions.width &&
              other.position.x < movedX + movingBox.dimensions.width;
            const overlapZ =
              movedZ < other.position.z + other.dimensions.depth &&
              other.position.z < movedZ + movingBox.dimensions.depth;
            if (overlapX && overlapZ) {
              const otherTop = other.position.y + other.dimensions.height;
              if (otherTop > stackY) stackY = otherTop;
            }
          }
        }

        updates.push({ id, position: { x: movedX, y: stackY, z: movedZ } });
      }

      onMoveSelected(updates);
    } else {
      // Single box drag — original behavior
      let stackY = 0;
      for (const other of allBoxes) {
        if (other.id === box.id) continue;
        const overlapX =
          newX < other.position.x + other.dimensions.width &&
          other.position.x < newX + box.dimensions.width;
        const overlapZ =
          newZ < other.position.z + other.dimensions.depth &&
          other.position.z < newZ + box.dimensions.depth;
        if (overlapX && overlapZ) {
          const otherTop = other.position.y + other.dimensions.height;
          if (otherTop > stackY) stackY = otherTop;
        }
      }

      onMove(box.id, { x: newX, y: stackY, z: newZ });
    }
  };

  const handlePointerUp = () => {
    // If we clicked on an already-selected box in a multi-selection without dragging,
    // replace the selection with just this box (standard click behavior)
    if (!didDrag.current && wasMultiSelected.current && !pointerDownShift.current) {
      onSelect(box.id);
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
    </group>
  );
}
