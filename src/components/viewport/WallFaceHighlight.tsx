import { Box } from '../../types';

interface WallFaceHighlightProps {
  box: Box;
  faceNormal: { x: number; y: number; z: number };
}

export function WallFaceHighlight({ box, faceNormal }: WallFaceHighlightProps) {
  const { position: pos, dimensions: dims } = box;

  // Center of the box (visual center)
  const cx = pos.x + dims.width / 2;
  const cy = pos.y + dims.height / 2;
  const cz = pos.z + dims.depth / 2;

  let planeX = cx;
  let planeY = cy;
  let planeZ = cz;
  let planeWidth = dims.width;
  let planeHeight = dims.height;
  let rotY = 0;

  if (faceNormal.z !== 0) {
    // Front (0,0,-1) or back (0,0,1) face — XY plane
    planeZ = faceNormal.z < 0 ? pos.z : pos.z + dims.depth;
    planeWidth = dims.width;
    planeHeight = dims.height;
    rotY = 0;
  } else if (faceNormal.x !== 0) {
    // Left (-1,0,0) or right (1,0,0) face — YZ plane
    planeX = faceNormal.x < 0 ? pos.x : pos.x + dims.width;
    planeWidth = dims.depth;
    planeHeight = dims.height;
    rotY = Math.PI / 2;
  }

  return (
    <mesh
      position={[planeX, planeY, planeZ]}
      rotation={[0, rotY, 0]}
    >
      <planeGeometry args={[planeWidth, planeHeight]} />
      <meshBasicMaterial
        color="#F59E0B"
        transparent
        opacity={0.35}
        depthWrite={false}
      />
    </mesh>
  );
}
