import { useRef, useState, useMemo } from 'react';
import { ThreeEvent, useThree } from '@react-three/fiber';
import { Mesh, Vector3, BoxGeometry } from 'three';
import { Box } from '../../types';
import { getMaterialColor } from '../../core/materials';

interface Box3DProps {
  box: Box;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, position: { x: number; y: number; z: number }) => void;
}

export function Box3D({ box, isSelected, onSelect, onMove }: Box3DProps) {
  const meshRef = useRef<Mesh>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(new Vector3());
  const { camera, raycaster, pointer } = useThree();

  const color = getMaterialColor(box.materialId);

  const outlineGeometry = useMemo(() => {
    return new BoxGeometry(
      box.dimensions.width * 1.01,
      box.dimensions.height * 1.01,
      box.dimensions.depth * 1.01
    );
  }, [box.dimensions.width, box.dimensions.height, box.dimensions.depth]);

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onSelect(box.id);

    // Calculate offset for dragging
    const groundPlane = new Vector3(0, 1, 0);
    const planePoint = new Vector3(0, box.position.y, 0);

    raycaster.setFromCamera(pointer, camera);
    const intersectPoint = new Vector3();
    raycaster.ray.intersectPlane(
      { normal: groundPlane, constant: -planePoint.y } as never,
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
    const planePoint = new Vector3(0, box.position.y, 0);

    raycaster.setFromCamera(pointer, camera);
    const intersectPoint = new Vector3();
    raycaster.ray.intersectPlane(
      { normal: groundPlane, constant: -planePoint.y } as never,
      intersectPoint
    );

    const newX = intersectPoint.x + dragOffset.x;
    const newZ = intersectPoint.z + dragOffset.z;

    onMove(box.id, {
      x: Math.round(newX * 4) / 4, // Snap to 0.25m grid
      y: box.position.y,
      z: Math.round(newZ * 4) / 4,
    });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  return (
    <group
      position={[box.position.x, box.position.y, box.position.z]}
      rotation={[0, box.rotation, 0]}
    >
      <mesh
        ref={meshRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <boxGeometry
          args={[box.dimensions.width, box.dimensions.height, box.dimensions.depth]}
        />
        <meshStandardMaterial
          color={color}
          transparent={isSelected}
          opacity={isSelected ? 0.9 : 1}
        />
      </mesh>

      {/* Selection outline */}
      {isSelected && (
        <lineSegments>
          <edgesGeometry args={[outlineGeometry]} />
          <lineBasicMaterial color="#3b82f6" linewidth={2} />
        </lineSegments>
      )}
    </group>
  );
}
