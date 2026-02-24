export type HeaderStyle = 'built-up' | 'single-2x6' | 'single-2x8' | 'single-2x10';

export interface WallOpening {
  id: string;
  type: 'door' | 'window';
  position: number;      // meters from start of wall
  width: number;
  height: number;        // rough opening height
  sillHeight?: number;   // windows only — distance from bottom plate top
  headerStyle: HeaderStyle;
}

export interface WallTargetFace {
  sourceBoxId: string;
  faceAxis: 'x' | 'z';    // which horizontal axis the wall runs along
  wallStartX: number;      // corner of wall in world space
  wallStartZ: number;
  wallY: number;
  wallLength: number;
  wallHeight: number;
  wallDepth: number;       // wall thickness
}
