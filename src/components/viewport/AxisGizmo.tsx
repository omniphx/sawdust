import { GizmoHelper, GizmoViewport } from '@react-three/drei';

export function AxisGizmo() {
  return (
    <GizmoHelper alignment="top-left" margin={[80, 80]}>
      <GizmoViewport
        axisColors={['#ef4444', '#22c55e', '#3b82f6']}
        labelColor="white"
      />
    </GizmoHelper>
  );
}
