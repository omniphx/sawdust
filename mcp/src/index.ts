#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadFile } from './file.js';
import { registerProjectTools } from './tools/project.js';
import { registerMaterialsTools } from './tools/materials.js';
import { registerBoxesTools } from './tools/boxes.js';
import { registerCutsTools } from './tools/cuts.js';
import { registerGroupsTools } from './tools/groups.js';
import { registerBomTools } from './tools/bom.js';

function parseArgs(): string {
  const args = process.argv.slice(2);
  const idx = args.indexOf('--file');

  if (idx === -1 || !args[idx + 1]) {
    console.error('Usage: opencad-mcp --file <path-to-.opencad.json>');
    process.exit(1);
  }

  return args[idx + 1];
}

async function main(): Promise<void> {
  const filePath = parseArgs();

  // Validate the file is readable and valid before starting
  try {
    loadFile(filePath);
  } catch (err) {
    console.error(`Failed to load OpenCAD file: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  const server = new McpServer({
    name: 'opencad',
    version: '0.1.0',
  });

  registerProjectTools(server, filePath);
  registerMaterialsTools(server);
  registerBoxesTools(server, filePath);
  registerCutsTools(server, filePath);
  registerGroupsTools(server, filePath);
  registerBomTools(server, filePath);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
