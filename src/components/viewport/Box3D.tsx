import { useRef, useState, useMemo } from 'react';
import { ThreeEvent, useThree } from '@react-three/fiber';
import { Mesh, Vector3, BoxGeometry } from 'three';
import { Box } from '../../types';
import { getMaterialColor } from '../../core/materials';

interface Box3DProps {
  box: Box;
  allBoxes: Box[];
  isSelected: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, position: { x: number; y: number; z: number }) => void;
  snap: (v: number) => number;
}

export function Box3D({ box, allBoxes, isSelected, onSelect, onMove, snap }: Box3DProps) {
  const meshRef = useRef<Mesh>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(new Vector3());
  const dragPlaneY = useRef(0);
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
    onSelect(box.id);

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

    // Find the highest box we overlap on XZ and stack on top of it
    // Position is the corner, so box extends from (x, y, z) to (x+w, y+h, z+d)
    let stackY = 0; // ground level

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

    onMove(box.id, {
      x: newX,
      y: stackY,
      z: newZ,
    });
  };

  const handlePointerUp = () => {
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
    </group>
  );
}
