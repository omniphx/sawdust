# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm install        # Install dependencies
npm run dev        # Start development server at http://localhost:5173
npm run build      # TypeScript check + production build
npm run lint       # Run ESLint
npm run preview    # Preview production build
```

## Architecture

OpenCAD is a simple CAD web app for designing 3D structures with material labeling and bill of materials output.

- **Entry Point:** `src/main.tsx` renders the React app
- **State Management:** React Context (`src/store/projectStore.tsx`) holds project state
- **Persistence:** Dexie.js wraps IndexedDB for local storage
- **3D Rendering:** @react-three/fiber (Three.js) with isometric OrthographicCamera
- **Data Flow:** User interactions update project state -> state changes auto-save to IndexedDB and re-render 3D viewport + BOM panel

## Key Directories

- `src/types/` - TypeScript interfaces (Box, Material, Project)
- `src/core/` - Business logic (units conversion, materials catalog, BOM calculation, storage)
- `src/store/` - React context for project state management
- `src/hooks/` - Custom hooks (useProject, useSelection)
- `src/components/viewport/` - Three.js/R3F components (Viewport, Box3D, Grid, IsometricCamera)
- `src/components/layout/` - UI panels (Toolbar, PropertiesPanel, BOMPanel)
- `src/components/ui/` - Reusable inputs (MaterialPicker, DimensionInput)

## Important Patterns

- **Units:** All dimensions stored internally in meters; converted to display units (ft or cm) at render time
- **BOM Calculation:** Aggregates materials by type using different quantity calculations (board feet for lumber, square feet for sheet goods, etc.)
- **Box Selection:** Click to select, drag to move on XZ plane, edit properties in side panel
- **Auto-save:** Project saves to IndexedDB whenever state changes
