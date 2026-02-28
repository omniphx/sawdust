import { useMemo } from 'react';
import { Html } from '@react-three/drei';
import { AxesHelper } from 'three';

export function AxisGizmo() {
  const axesHelper = useMemo(() => new AxesHelper(1), []);

  return (
    <group position={[0, 0.01, 0]}>
      <primitive object={axesHelper} />
      <Html position={[1.15, 0, 0]} center>
        <span style={{ color: '#ef4444', fontSize: '11px', fontWeight: 'bold', userSelect: 'none', textShadow: '0 0 3px white' }}>X</span>
      </Html>
      <Html position={[0, 1.15, 0]} center>
        <span style={{ color: '#22c55e', fontSize: '11px', fontWeight: 'bold', userSelect: 'none', textShadow: '0 0 3px white' }}>Y</span>
      </Html>
      <Html position={[0, 0, 1.15]} center>
        <span style={{ color: '#3b82f6', fontSize: '11px', fontWeight: 'bold', userSelect: 'none', textShadow: '0 0 3px white' }}>Z</span>
      </Html>
    </group>
  );
}
