import { useRef, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { OrthographicCamera } from 'three';

export function IsometricCamera() {
  const { set, size } = useThree();
  const cameraRef = useRef<OrthographicCamera>(null);

  useEffect(() => {
    if (cameraRef.current) {
      set({ camera: cameraRef.current });
    }
  }, [set]);

  const zoom = 100;

  // Isometric angle: camera looks from corner at 45 degrees
  // Standard isometric: rotate 45 on Y, then ~35.264 degrees down (arctan(1/sqrt(2)))
  const distance = 20;
  const angle = Math.PI / 4; // 45 degrees
  const elevation = Math.atan(1 / Math.sqrt(2)); // ~35.264 degrees

  const x = distance * Math.cos(elevation) * Math.sin(angle);
  const y = distance * Math.sin(elevation);
  const z = distance * Math.cos(elevation) * Math.cos(angle);

  return (
    <orthographicCamera
      ref={cameraRef}
      position={[x, y, z]}
      zoom={zoom}
      left={-size.width / 2}
      right={size.width / 2}
      top={size.height / 2}
      bottom={-size.height / 2}
      near={0.1}
      far={1000}
      onUpdate={(camera) => camera.lookAt(0, 0, 0)}
    />
  );
}
