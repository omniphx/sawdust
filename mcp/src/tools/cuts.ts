import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { loadFile, saveFile } from '../file.js';

const CUT_FACES = ['top', 'bottom', 'front', 'back', 'left', 'right'] as const;
const CUT_EDGES = ['top', 'bottom', 'front', 'back'] as const;

export function registerCutsTools(server: McpServer, filePath: string): void {
  server.tool(
    'add_cut',
    'Add an angle cut to a box face',
    {
      boxId: z.string().describe('Box UUID'),
      face: z.enum(CUT_FACES).describe('Which face the cut starts from'),
      angle: z.number().min(0).max(89).describe('Cut angle in degrees (0=square, 45=miter)'),
      edge: z.enum(CUT_EDGES).optional().describe('Adjacent face edge where the blade enters (e.g. "front" or "back" for top/bottom faces)'),
      depth: z.number().positive().optional().describe('Cut depth in meters from the face (omit for full through-cut)'),
    },
    async ({ boxId, face, angle, edge, depth }) => {
      const data = loadFile(filePath);
      const box = data.project.boxes.find((b) => b.id === boxId);

      if (!box) {
        return { content: [{ type: 'text', text: `Box "${boxId}" not found` }], isError: true };
      }

      if (!box.cuts) box.cuts = [];

      const cut = {
        id: uuidv4(),
        face,
        angle,
        ...(edge !== undefined && { edge }),
        ...(depth !== undefined && { depth }),
      };

      box.cuts.push(cut);
      saveFile(filePath, data);

      return { content: [{ type: 'text', text: JSON.stringify(cut, null, 2) }] };
    },
  );

  server.tool(
    'update_cut',
    'Update a cut on a box',
    {
      boxId: z.string().describe('Box UUID'),
      cutId: z.string().describe('Cut UUID'),
      face: z.enum(CUT_FACES).optional(),
      angle: z.number().min(0).max(89).optional(),
      edge: z.enum(CUT_EDGES).optional().describe('Adjacent face edge where the blade enters'),
      depth: z.number().positive().optional(),
    },
    async ({ boxId, cutId, face, angle, edge, depth }) => {
      const data = loadFile(filePath);
      const box = data.project.boxes.find((b) => b.id === boxId);

      if (!box) {
        return { content: [{ type: 'text', text: `Box "${boxId}" not found` }], isError: true };
      }

      const cut = box.cuts?.find((c) => c.id === cutId);
      if (!cut) {
        return { content: [{ type: 'text', text: `Cut "${cutId}" not found on box` }], isError: true };
      }

      if (face !== undefined) cut.face = face;
      if (angle !== undefined) cut.angle = angle;
      if (edge !== undefined) cut.edge = edge;
      if (depth !== undefined) cut.depth = depth;

      saveFile(filePath, data);

      return { content: [{ type: 'text', text: JSON.stringify(cut, null, 2) }] };
    },
  );

  server.tool(
    'remove_cut',
    'Remove a cut from a box',
    {
      boxId: z.string().describe('Box UUID'),
      cutId: z.string().describe('Cut UUID to remove'),
    },
    async ({ boxId, cutId }) => {
      const data = loadFile(filePath);
      const box = data.project.boxes.find((b) => b.id === boxId);

      if (!box) {
        return { content: [{ type: 'text', text: `Box "${boxId}" not found` }], isError: true };
      }

      if (!box.cuts) {
        return { content: [{ type: 'text', text: `Cut "${cutId}" not found on box` }], isError: true };
      }

      const index = box.cuts.findIndex((c) => c.id === cutId);
      if (index === -1) {
        return { content: [{ type: 'text', text: `Cut "${cutId}" not found on box` }], isError: true };
      }

      box.cuts.splice(index, 1);
      saveFile(filePath, data);

      return { content: [{ type: 'text', text: `Cut "${cutId}" removed from box "${boxId}"` }] };
    },
  );
}
