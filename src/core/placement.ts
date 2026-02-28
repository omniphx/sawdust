import { v4 as uuid } from 'uuid';
import { Box, ComponentTemplate } from '../types';

/**
 * Places a component's boxes into the project by generating new UUIDs
 * and finding a non-overlapping position along the X axis.
 */
export function placeComponentBoxes(
  template: ComponentTemplate,
  existingBoxes: Box[]
): Box[] {
  if (template.boxes.length === 0) return [];

  // Calculate bounding box of the template
  // Position is the corner, so box extends from (x,z) to (x+w,z+d)
  let minX = Infinity, maxX = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  for (const box of template.boxes) {
    minX = Math.min(minX, box.position.x);
    maxX = Math.max(maxX, box.position.x + box.dimensions.width);
    minZ = Math.min(minZ, box.position.z);
    maxZ = Math.max(maxZ, box.position.z + box.dimensions.depth);
  }

  const templateWidth = maxX - minX;
  const templateDepth = maxZ - minZ;
  const spacing = 0.25;

  // Find non-overlapping X position by scanning along X axis
  let offsetX = 0;
  const centerZ = 0;

  const isOverlapping = (ox: number) => {
    // Check if placing the template bounding box at ox would overlap any existing box
    const tMinX = ox;
    const tMaxX = ox + templateWidth;
    const tMinZ = centerZ - templateDepth / 2;
    const tMaxZ = centerZ + templateDepth / 2;

    for (const b of existingBoxes) {
      const bMinX = b.position.x;
      const bMaxX = b.position.x + b.dimensions.width;
      const bMinZ = b.position.z;
      const bMaxZ = b.position.z + b.dimensions.depth;

      if (
        tMinX < bMaxX + spacing &&
        tMaxX > bMinX - spacing &&
        tMinZ < bMaxZ + spacing &&
        tMaxZ > bMinZ - spacing
      ) {
        return true;
      }
    }
    return false;
  };

  while (isOverlapping(offsetX)) {
    offsetX += templateWidth + spacing;
  }

  // Generate new boxes with new IDs, offset positions, and a shared groupId
  // Shift so template's minX aligns to offsetX, and center on Z
  const shiftX = offsetX - minX;
  const shiftZ = centerZ - (minZ + maxZ) / 2;
  const groupId = template.boxes.length > 1 ? uuid() : undefined;

  return template.boxes.map((box) => ({
    ...box,
    id: uuid(),
    groupId,
    position: {
      x: box.position.x + shiftX,
      y: box.position.y,
      z: box.position.z + shiftZ,
    },
  }));
}
