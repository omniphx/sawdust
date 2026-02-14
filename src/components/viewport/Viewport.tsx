import { useRef, useEffect, useCallback } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Vector3 } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { IsometricCamera } from './IsometricCamera';
import { Grid } from './Grid';
import { Box3D } from './Box3D';
import { useProjectStore } from '../../store/projectStore';

const MIN_ZOOM = 20;
const MAX_ZOOM = 500;

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
  const { state, selectBox, updateBox } = useProjectStore();
  const controlsRef = useRef<OrbitControlsImpl>(null);

  const handleMove = (id: string, position: { x: number; y: number; z: number }) => {
    updateBox(id, { position });
  };

  const handleBackgroundClick = () => {
    selectBox(null);
  };

  return (
    <div className="flex-1 bg-sky-50">
      <Canvas>
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
        {/* Hemisphere light gives different tint to sky-facing vs ground-facing surfaces */}
        <hemisphereLight args={['#b0d0ff', '#806040', 0.6]} />
        {/* Key light from upper-right-front */}
        <directionalLight position={[5, 12, 8]} intensity={1} />
        {/* Fill light from left to soften shadows without flattening */}
        <directionalLight position={[-8, 6, -3]} intensity={0.25} />

        <Grid />

        {/* Background plane for deselection */}
        <mesh
          position={[0, -0.01, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          onClick={handleBackgroundClick}
        >
          <planeGeometry args={[100, 100]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>

        {(state.mode === 'component-builder'
          ? (state.currentTemplate?.boxes ?? [])
          : state.project.boxes
        ).map((box) => (
          <Box3D
            key={box.id}
            box={box}
            allBoxes={
              state.mode === 'component-builder'
                ? (state.currentTemplate?.boxes ?? [])
                : state.project.boxes
            }
            isSelected={box.id === state.selectedBoxId}
            onSelect={selectBox}
            onMove={handleMove}
          />
        ))}
      </Canvas>
    </div>
  );
}
