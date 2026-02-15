# PRD: Multi-Select, Grouping, Lock, and Undo/Redo

## Introduction

OpenCAD currently supports single-item selection only, with no way to undo mistakes, lock items in place, or manipulate multiple boxes at once. This PRD covers four tightly related features that together bring the editing experience closer to professional CAD tools:

1. **Multi-select** — marquee (box select) and Shift+Click to select multiple boxes
2. **Group operations** — move, delete, and drag multiple selected items together; permanent named groups
3. **Lock** — prevent accidental movement or deletion of specific items
4. **Undo/Redo** — full action history with toolbar buttons and keyboard shortcuts

These features address the most common pain points when building complex structures: accidentally moving a carefully placed box, having to reposition items one-by-one, and having no way to recover from mistakes.

## Goals

- Allow selecting multiple boxes via marquee drag and Shift+Click
- Enable moving, deleting, and duplicating multiple selected boxes in one action
- Provide permanent grouping so related boxes always move together
- Allow locking individual boxes or groups to prevent accidental edits
- Implement undo/redo with unlimited session history (clears on page reload)
- Add undo/redo buttons to the toolbar and support Cmd+Z / Shift+Cmd+Z shortcuts

## User Stories

### US-001: Marquee (Box) Select
**Description:** As a user, I want to click and drag on an empty area of the viewport to draw a selection rectangle so that I can select multiple boxes at once.

**Acceptance Criteria:**
- [ ] Click-and-drag on empty viewport area draws a visible selection rectangle (2D overlay)
- [ ] All boxes whose footprint overlaps the marquee rectangle on release are added to the selection
- [ ] Selected boxes show a distinct visual indicator (e.g., highlighted outline)
- [ ] Clicking on empty space (without dragging) deselects all
- [ ] Marquee only activates when starting on empty space (not on an existing box)
- [ ] Typecheck passes (`npm run build`)
- [ ] Verify in browser using dev-browser skill

### US-002: Shift+Click Multi-Select
**Description:** As a user, I want to Shift+Click individual boxes to add or remove them from my selection so that I can fine-tune which items are selected.

**Acceptance Criteria:**
- [ ] Shift+Click on an unselected box adds it to the current selection
- [ ] Shift+Click on an already-selected box removes it from the selection
- [ ] Regular click (no Shift) on a box replaces the entire selection with just that box
- [ ] Selection state (`selectedBoxIds: string[]`) replaces the current `selectedBoxId: string | null`
- [ ] PropertiesPanel shows a multi-select summary when 2+ boxes are selected (count, shared material if any)
- [ ] Typecheck passes (`npm run build`)
- [ ] Verify in browser using dev-browser skill

### US-003: Multi-Select Move (Drag)
**Description:** As a user, I want to drag any selected box and have all other selected boxes move with it so that I can reposition groups of items together.

**Acceptance Criteria:**
- [ ] Dragging one box in a multi-selection moves all selected boxes by the same offset
- [ ] Relative positions between selected boxes are preserved during the drag
- [ ] Snap-to-grid applies to the dragged box; others follow the same offset
- [ ] Auto-stacking behavior still works for the dragged group
- [ ] Typecheck passes (`npm run build`)
- [ ] Verify in browser using dev-browser skill

### US-004: Multi-Select Delete
**Description:** As a user, I want to press Delete/Backspace and have all selected boxes removed so that I can quickly clear multiple items.

**Acceptance Criteria:**
- [ ] Pressing Delete or Backspace removes all selected (non-locked) boxes
- [ ] If some selected boxes are locked, show a warning indicator and skip the locked ones
- [ ] Selection clears after deletion
- [ ] The delete action is captured in undo history (see US-009)
- [ ] Typecheck passes (`npm run build`)
- [ ] Verify in browser using dev-browser skill

### US-005: Multi-Select Duplicate
**Description:** As a user, I want to duplicate all selected boxes at once so that I can quickly repeat a set of items.

**Acceptance Criteria:**
- [ ] Cmd+D duplicates all selected boxes, offset to avoid overlap
- [ ] New duplicates become the new selection
- [ ] Relative positions between duplicated boxes are preserved
- [ ] Typecheck passes (`npm run build`)
- [ ] Verify in browser using dev-browser skill

### US-006: Create Permanent Group
**Description:** As a user, I want to group selected boxes into a permanent group so they always move, duplicate, and delete as a unit.

**Acceptance Criteria:**
- [ ] "Group" button appears in toolbar or properties panel when 2+ boxes are selected
- [ ] Grouped boxes are assigned a shared `groupId` on the Box type
- [ ] Clicking any box in a group selects the entire group
- [ ] Grouped boxes show a subtle shared visual indicator (e.g., matching colored outline)
- [ ] Groups persist across sessions (groupId saved to IndexedDB)
- [ ] Typecheck passes (`npm run build`)
- [ ] Verify in browser using dev-browser skill

### US-007: Ungroup
**Description:** As a user, I want to ungroup a set of grouped boxes so they become independent items again.

**Acceptance Criteria:**
- [ ] "Ungroup" button appears when a group is selected
- [ ] Ungrouping removes `groupId` from all boxes in the group
- [ ] After ungrouping, boxes remain selected but behave independently
- [ ] Typecheck passes (`npm run build`)
- [ ] Verify in browser using dev-browser skill

### US-008: Lock / Unlock Items
**Description:** As a user, I want to lock boxes in place so they cannot be accidentally moved or deleted.

**Acceptance Criteria:**
- [ ] Lock/Unlock toggle button in PropertiesPanel for selected box(es)
- [ ] Lock icon button in toolbar when items are selected
- [ ] Locked boxes display a small lock icon overlay in the viewport
- [ ] Locked boxes can be selected (click or marquee) and inspected in PropertiesPanel
- [ ] Attempting to drag a locked box shows a visual warning (e.g., brief shake or toast) and does not move it
- [ ] Attempting to delete a locked box shows a visual warning and does not delete it
- [ ] Locked state (`locked: boolean`) stored on the Box type, persists to IndexedDB
- [ ] Typecheck passes (`npm run build`)
- [ ] Verify in browser using dev-browser skill

### US-009: Undo/Redo History System
**Description:** As a developer, I need an undo/redo history system in the state management layer so that all box mutations can be reversed.

**Acceptance Criteria:**
- [ ] History stores snapshots of `project.boxes` array after each mutation
- [ ] Undo restores the previous snapshot; redo re-applies the next snapshot
- [ ] History is unlimited within the session (resets on page reload)
- [ ] History tracks: add, delete, update (move/resize/material change), duplicate, paste, group, ungroup, lock/unlock
- [ ] Performing a new action after an undo clears the redo stack
- [ ] Typecheck passes (`npm run build`)

### US-010: Undo/Redo UI and Shortcuts
**Description:** As a user, I want undo/redo buttons in the toolbar and keyboard shortcuts so I can quickly reverse mistakes.

**Acceptance Criteria:**
- [ ] Undo button (left-curved arrow icon) in the toolbar
- [ ] Redo button (right-curved arrow icon) in the toolbar
- [ ] Undo button disabled when no history to undo; redo disabled when nothing to redo
- [ ] Cmd+Z triggers undo
- [ ] Shift+Cmd+Z triggers redo
- [ ] Shortcuts work when viewport is focused (not when editing text inputs)
- [ ] Typecheck passes (`npm run build`)
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: Replace `selectedBoxId: string | null` with `selectedBoxIds: string[]` in ProjectState
- FR-2: Implement marquee selection as a 2D overlay on the R3F Canvas that maps screen coordinates to world-space box positions
- FR-3: Shift+Click toggles individual box membership in the selection set
- FR-4: Dragging any box in a multi-selection applies the same XZ offset to all selected boxes
- FR-5: Delete/Backspace removes all selected boxes that are not locked
- FR-6: Cmd+D duplicates all selected boxes preserving relative positions
- FR-7: Add `groupId?: string` field to the Box interface; grouped boxes share the same `groupId`
- FR-8: Clicking any box with a `groupId` selects all boxes with that same `groupId`
- FR-9: Add `locked: boolean` field (default `false`) to the Box interface
- FR-10: Locked boxes reject move and delete operations; show a warning indicator when attempted
- FR-11: Implement undo/redo as an array of `Box[]` snapshots with a current-index pointer in ProjectState
- FR-12: Every action that mutates `project.boxes` pushes a new snapshot to the history stack
- FR-13: Undo decrements the history index and restores that snapshot; redo increments
- FR-14: New mutations after an undo truncate the redo history
- FR-15: Add undo/redo buttons to the Toolbar component with disabled states
- FR-16: Register Cmd+Z and Shift+Cmd+Z keyboard shortcuts for undo/redo in App.tsx

## Non-Goals

- No nested groups (groups inside groups)
- No partial-lock (e.g., lock position but allow material changes) — lock is all-or-nothing for move/delete
- No undo history persistence across page reloads
- No collaborative/multi-user undo
- No lasso (freeform) selection — only rectangular marquee
- No "Select All" shortcut (can be added later)
- No visual grouping labels or group naming in the UI

## Design Considerations

- The marquee selection rectangle should be a semi-transparent overlay (e.g., blue with 20% opacity fill, solid border) rendered as a 2D HTML overlay on the Canvas, not a 3D object
- Multi-selected boxes should have a visually distinct outline (e.g., thicker or different color than single-select)
- The lock icon overlay on locked boxes should be small and unobtrusive (bottom-right corner of the box)
- Undo/redo buttons should be placed in the left section of the toolbar, after the "Add Box" button, using standard arrow icons
- Disabled undo/redo buttons should be visually dimmed
- Warning indicators for locked items (on attempted move/delete) can be a brief CSS animation or subtle toast — keep it non-blocking

## Technical Considerations

- **Selection refactor:** Changing from `selectedBoxId` to `selectedBoxIds` will touch many files — Viewport, Box3D, PropertiesPanel, BOMPanel, App.tsx keyboard shortcuts, and useSelection hook
- **Undo/redo architecture:** Snapshot-based (storing full `boxes[]` array) is simpler than command-based and sufficient given typical project sizes (under a few hundred boxes). Each snapshot is a deep clone of the boxes array.
- **Marquee selection:** Needs to project 3D box positions to 2D screen coordinates (via Three.js `Vector3.project()`) and test against the marquee rectangle. Since the camera is orthographic/isometric, this projection is straightforward.
- **Drag offset for multi-select:** When drag starts, record the initial positions of all selected boxes. On each move event, compute the delta from the dragged box's start position and apply it to all selected boxes.
- **Group click behavior:** In `Box3D.handlePointerDown`, if the clicked box has a `groupId`, expand the selection to all boxes with that `groupId` before handling drag.
- **Performance:** Deep-cloning the boxes array for undo snapshots is fine for typical project sizes. If projects grow very large, consider switching to structural sharing or diff-based history.
- **Auto-save interaction:** Auto-save should save the current state (not the undo history). Undo history lives only in memory.

## Success Metrics

- Users can select 10+ boxes in under 2 seconds using marquee
- Moving a group of selected boxes feels as responsive as moving a single box (no perceptible lag)
- Undo/redo responds instantly (< 100ms) for typical projects
- Zero accidental moves on locked items
- All existing single-select workflows continue to work identically

## Open Questions

- Should Cmd+A select all boxes? (Deferred to future iteration)
- Should groups have user-visible names or labels? (Deferred — grouping is visual-only for now)
- Should the properties panel allow editing shared properties (e.g., material) across a multi-selection? (Nice to have, but not required for v1)
- Should locked boxes have a different visual style beyond the lock icon (e.g., dimmed opacity)?
