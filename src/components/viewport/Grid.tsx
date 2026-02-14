import { Grid as DreiGrid } from '@react-three/drei';

export function Grid() {
  return (
    <DreiGrid
      position={[0, 0, 0]}
      args={[20, 20]}
      cellSize={0.5}
      cellThickness={0.5}
      cellColor="#6b7280"
      sectionSize={1}
      sectionThickness={1}
      sectionColor="#374151"
      fadeDistance={50}
      fadeStrength={1}
      infiniteGrid
    />
  );
}
