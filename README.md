# Sawdust

A browser-based 3D CAD app for designing structures with material labeling and bill of materials output. Built with React, Three.js, and IndexedDB for fully local, offline-first use.

## Getting Started

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production build
```

## Features

- 3D isometric viewport with click-to-select, drag-to-move boxes
- Material assignment with automatic BOM calculation
- Angle cuts on box faces using CSG subtraction
- Export/Import projects as `.sawdust.json` files
- Local persistence via IndexedDB (no backend required)

---

## MCP Server (AI Integration)

The MCP server lets AI assistants read and modify your Sawdust projects via tool calls. The workflow is file-based: export your project, let the AI modify it, then import it back.

### Usage

1. In the Sawdust app, click **Export** — saves `MyProject.sawdust.json` to your Downloads folder
2. Configure your AI tool (see below) pointing to that file
3. Ask the AI to modify your project — it will call the available tools
4. In the Sawdust app, click **Import** and select the same file to load the changes

### Setup

Replace `/path/to/MyProject.sawdust.json` with the actual path to your exported file.

#### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "sawdust": {
      "command": "npx",
      "args": ["-y", "@omniphx/sawdust-mcp", "--file", "/path/to/MyProject.sawdust.json"]
    }
  }
}
```

Restart Claude Desktop after saving.

#### Claude Code

```bash
claude mcp add --scope user sawdust -- npx -y @omniphx/sawdust-mcp --file /path/to/MyProject.sawdust.json
```

#### Cursor

Add to `.cursor/mcp.json` in your project root (or `~/.cursor/mcp.json` for global):

```json
{
  "sawdust": {
    "command": "npx",
    "args": ["-y", "@omniphx/sawdust-mcp", "--file", "/path/to/MyProject.sawdust.json"]
  }
}
```

Restart Cursor after saving.

#### OpenCode

Add to `opencode.json` in your project root (or `~/.config/opencode/opencode.json` for global):

```json
{
  "mcp": {
    "sawdust": {
      "type": "local",
      "command": ["npx", "-y", "@omniphx/sawdust-mcp", "--file", "/path/to/MyProject.sawdust.json"]
    }
  }
}
```

#### Codex CLI

```bash
codex mcp add sawdust -- npx -y @omniphx/sawdust-mcp --file /path/to/MyProject.sawdust.json
```

Or manually in `~/.codex/config.toml`:

```toml
[mcp_servers.sawdust]
command = ["npx", "-y", "@omniphx/sawdust-mcp", "--file", "/path/to/MyProject.sawdust.json"]
```

### Available Tools

| Tool | Description |
|------|-------------|
| `get_project` | Get project name, unit system, and box count |
| `set_project_name` | Rename the project |
| `clear_project` | Remove all boxes from the project; optionally reset the name |
| `list_materials` | List all available materials with IDs and unit types |
| `list_boxes` | List all boxes, with optional `materialId` / `label` filters |
| `get_box` | Get a single box by `id` or `label` |
| `add_box` | Create a new box (position and dimensions in meters) |
| `update_box` | Update any fields on an existing box |
| `delete_box` | Remove a box by ID |
| `add_cut` | Add an angle cut to a box face |
| `update_cut` | Modify an existing cut |
| `remove_cut` | Remove a cut from a box |
| `group_boxes` | Assign a shared group ID to multiple boxes |
| `ungroup_boxes` | Remove group assignment from boxes |
| `set_box_locked` | Lock or unlock a box |
| `set_box_hidden` | Show or hide a box |
| `get_bom` | Calculate and return the bill of materials |

### Notes

- All dimension and position values are in **meters**
- Material IDs (e.g. `2x4-lumber`, `plywood-3-4`) can be found via `list_materials`
- The server reads and writes the `.sawdust.json` file directly on disk — changes are immediate
- To switch projects, update the `--file` path in your config and restart
