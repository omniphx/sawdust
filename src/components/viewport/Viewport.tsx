import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { IsometricCamera } from './IsometricCamera';
import { Grid } from './Grid';
import { Box3D } from './Box3D';
import { useProjectStore } from '../../store/projectStore';

export function Viewport() {
  const { state, selectBox, updateBox } = useProjectStore();

  const handleMove = (id: string, position: { x: number; y: number; z: number }) => {
    updateBox(id, { position });
  };

  const handleBackgroundClick = () => {
    selectBox(null);
  };

  return (
    <div className="flex-1 bg-gray-900">
      <Canvas>
        <IsometricCamera />
        <OrbitControls
          enableRotate={false}
          enablePan={true}
          enableZoom={true}
          minZoom={20}
          maxZoom={500}
        />
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 20, 10]} intensity={0.8} castShadow />
        <directionalLight position={[-10, 20, -10]} intensity={0.3} />

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

        {state.project.boxes.map((box) => (
          <Box3D
            key={box.id}
            box={box}
            isSelected={box.id === state.selectedBoxId}
            onSelect={selectBox}
            onMove={handleMove}
          />
        ))}
      </Canvas>
    </div>
  );
}
