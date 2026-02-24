import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { loadFile, saveFile } from '../file.js';

export function registerBoxesTools(server: McpServer, filePath: string): void {
  server.tool(
    'list_boxes',
    'List all boxes in the project. Optionally filter by materialId or label.',
    {
      materialId: z.string().optional().describe('Filter by material ID'),
      label: z.string().optional().describe('Filter by label (case-insensitive substring match)'),
    },
    async ({ materialId, label }) => {
      const data = loadFile(filePath);
      let boxes = data.project.boxes;

      if (materialId) {
        boxes = boxes.filter((b) => b.materialId === materialId);
      }
      if (label) {
        const lower = label.toLowerCase();
        boxes = boxes.filter((b) => b.label?.toLowerCase().includes(lower));
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(boxes, null, 2) }],
      };
    },
  );

  server.tool(
    'get_box',
    'Get a single box by id or label',
    {
      id: z.string().optional().describe('Box UUID'),
      label: z.string().optional().describe('Box label (exact match)'),
    },
    async ({ id, label }) => {
      const data = loadFile(filePath);
      const box = id
        ? data.project.boxes.find((b) => b.id === id)
        : data.project.boxes.find((b) => b.label === label);

      if (!box) {
        return {
          content: [{ type: 'text', text: `Box not found` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(box, null, 2) }],
      };
    },
  );

  server.tool(
    'add_box',
    'Add a new box to the project. All dimensions and positions are in meters.',
    {
      width: z.number().positive().describe('Width in meters'),
      height: z.number().positive().describe('Height in meters'),
      depth: z.number().positive().describe('Depth in meters'),
      x: z.number().describe('X position in meters'),
      y: z.number().describe('Y position in meters'),
      z: z.number().describe('Z position in meters'),
      materialId: z.string().describe('Material ID (see list_materials)'),
      label: z.string().optional().describe('Optional label'),
      groupId: z.string().optional().describe('Optional group ID'),
    },
    async ({ width, height, depth, x, y, z: zPos, materialId, label, groupId }) => {
      const data = loadFile(filePath);

      const newBox = {
        id: uuidv4(),
        position: { x, y, z: zPos },
        dimensions: { width, height, depth },
        rotation: { x: 0, y: 0, z: 0 },
        materialId,
        ...(label !== undefined && { label }),
        ...(groupId !== undefined && { groupId }),
      };

      data.project.boxes.push(newBox);
      saveFile(filePath, data);

      return {
        content: [{ type: 'text', text: JSON.stringify(newBox, null, 2) }],
      };
    },
  );

  server.tool(
    'update_box',
    'Update fields on an existing box by id. All dimension/position values are in meters.',
    {
      id: z.string().describe('Box UUID to update'),
      width: z.number().positive().optional(),
      height: z.number().positive().optional(),
      depth: z.number().positive().optional(),
      x: z.number().optional(),
      y: z.number().optional(),
      z: z.number().optional(),
      materialId: z.string().optional(),
      label: z.string().optional(),
      groupId: z.string().optional(),
      locked: z.boolean().optional(),
      hidden: z.boolean().optional(),
    },
    async ({ id, width, height, depth, x, y, z: zPos, materialId, label, groupId, locked, hidden }) => {
      const data = loadFile(filePath);
      const box = data.project.boxes.find((b) => b.id === id);

      if (!box) {
        return { content: [{ type: 'text', text: `Box "${id}" not found` }], isError: true };
      }

      if (width !== undefined) box.dimensions.width = width;
      if (height !== undefined) box.dimensions.height = height;
      if (depth !== undefined) box.dimensions.depth = depth;
      if (x !== undefined) box.position.x = x;
      if (y !== undefined) box.position.y = y;
      if (zPos !== undefined) box.position.z = zPos;
      if (materialId !== undefined) box.materialId = materialId;
      if (label !== undefined) box.label = label;
      if (groupId !== undefined) box.groupId = groupId;
      if (locked !== undefined) box.locked = locked;
      if (hidden !== undefined) box.hidden = hidden;

      saveFile(filePath, data);

      return {
        content: [{ type: 'text', text: JSON.stringify(box, null, 2) }],
      };
    },
  );

  server.tool(
    'delete_box',
    'Delete a box by id',
    { id: z.string().describe('Box UUID to delete') },
    async ({ id }) => {
      const data = loadFile(filePath);
      const index = data.project.boxes.findIndex((b) => b.id === id);

      if (index === -1) {
        return { content: [{ type: 'text', text: `Box "${id}" not found` }], isError: true };
      }

      data.project.boxes.splice(index, 1);
      saveFile(filePath, data);

      return { content: [{ type: 'text', text: `Box "${id}" deleted` }] };
    },
  );

  const boxSchema = z.object({
    width: z.number().positive().describe('Width in meters'),
    height: z.number().positive().describe('Height in meters'),
    depth: z.number().positive().describe('Depth in meters'),
    x: z.number().describe('X position in meters'),
    y: z.number().describe('Y position in meters'),
    z: z.number().describe('Z position in meters'),
    materialId: z.string().describe('Material ID (see list_materials)'),
    label: z.string().optional().describe('Optional label'),
    groupId: z.string().optional().describe('Optional group ID'),
  });

  server.tool(
    'bulk_add_boxes',
    'Add multiple boxes to the project in a single operation. All dimensions and positions are in meters.',
    { boxes: z.array(boxSchema).min(1).describe('Array of box definitions to add') },
    async ({ boxes }) => {
      const data = loadFile(filePath);

      const newBoxes = boxes.map(({ width, height, depth, x, y, z: zPos, materialId, label, groupId }) => ({
        id: uuidv4(),
        position: { x, y, z: zPos },
        dimensions: { width, height, depth },
        rotation: { x: 0, y: 0, z: 0 },
        materialId,
        ...(label !== undefined && { label }),
        ...(groupId !== undefined && { groupId }),
      }));

      data.project.boxes.push(...newBoxes);
      saveFile(filePath, data);

      return {
        content: [{ type: 'text', text: JSON.stringify(newBoxes, null, 2) }],
      };
    },
  );

  server.tool(
    'bulk_delete_boxes',
    'Delete multiple boxes by their IDs in a single operation.',
    { ids: z.array(z.string()).min(1).describe('Array of box UUIDs to delete') },
    async ({ ids }) => {
      const data = loadFile(filePath);

      const notFound: string[] = [];
      const deleted: string[] = [];

      for (const id of ids) {
        const index = data.project.boxes.findIndex((b) => b.id === id);
        if (index === -1) {
          notFound.push(id);
        } else {
          data.project.boxes.splice(index, 1);
          deleted.push(id);
        }
      }

      if (deleted.length > 0) {
        saveFile(filePath, data);
      }

      const result: Record<string, unknown> = { deleted };
      if (notFound.length > 0) result.notFound = notFound;

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        isError: notFound.length > 0 && deleted.length === 0,
      };
    },
  );
}
