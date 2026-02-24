import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { loadFile, saveFile } from '../file.js';

export function registerProjectTools(server: McpServer, filePath: string): void {
  server.tool(
    'get_project',
    'Get project metadata (name, unit system, box count, id)',
    {},
    async () => {
      const data = loadFile(filePath);
      const { id, name, unitSystem, boxes } = data.project;
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ id, name, unitSystem, boxCount: boxes.length }, null, 2),
          },
        ],
      };
    },
  );

  server.tool(
    'set_project_name',
    'Update the project name',
    { name: z.string().min(1).describe('New project name') },
    async ({ name }) => {
      const data = loadFile(filePath);
      data.project.name = name;
      saveFile(filePath, data);
      return {
        content: [{ type: 'text', text: `Project name updated to "${name}"` }],
      };
    },
  );

  server.tool(
    'clear_project',
    'Remove all boxes from the project, leaving an empty canvas. Optionally reset the project name.',
    {
      resetName: z.boolean().optional().describe('If true, reset the project name to "Untitled Project"'),
    },
    async ({ resetName }) => {
      const data = loadFile(filePath);
      const removedCount = data.project.boxes.length;
      data.project.boxes = [];
      if (resetName) {
        data.project.name = 'Untitled Project';
      }
      saveFile(filePath, data);
      return {
        content: [
          {
            type: 'text',
            text: `Cleared ${removedCount} box${removedCount !== 1 ? 'es' : ''} from the project.${resetName ? ' Project name reset to "Untitled Project".' : ''}`,
          },
        ],
      };
    },
  );
}
