# PRD: Group Drag Behavior

## Introduction

Grouping infrastructure already exists in the codebase — boxes can be assigned a `groupId`, there are Group/Ungroup toolbar buttons, and clicking a grouped box selects the whole group. However, the grouping is cosmetic only: dragging a grouped box does not move the other boxes in the group. This PRD adds the core group behavior: dragging any box in a group moves all group members maintaining their relative positions, and editing position in the properties panel applies the delta to the whole group. Individual dimension editing remains per-box.

## Goals

- Dragging any box in a group moves all group members, preserving relative positions
- Properties panel position changes (X/Y/Z) apply as a delta to the entire group
- Properties panel dimension changes (width/height/depth) remain per-individual-box
- Ungroup removes groupId from all boxes in the group (no partial ungroup)
- Add Cmd+G / Cmd+Shift+G keyboard shortcuts for group/ungroup
- No new data model changes needed (`groupId` already exists on Box)

## User Stories

### US-001: Auto-select entire group on click
**Description:** As a user, I want clicking any box in a group to select all boxes in that group so that I can see and manipulate the group as a unit.

**Acceptance Criteria:**
- [ ] Clicking a grouped box selects all boxes sharing the same `groupId`
- [ ] All group members show the selected visual state (blue highlight)
- [ ] This behavior already exists — verify it works correctly and does not regress
- [ ] Typecheck passes (`npm run build`)
- [ ] Verify in browser using dev-browser skill

### US-002: Drag grouped box moves entire group
**Description:** As a user, I want to drag any box in a group and have all group members move together, maintaining their relative positions.

**Acceptance Criteria:**
- [ ] Dragging a grouped box moves all boxes with the same `groupId`
- [ ] Relative positions between group members are preserved exactly
- [ ] The drag uses the clicked box as the anchor — other boxes offset relative to it
- [ ] Snap-to-grid applies to the dragged box; other group members follow the same delta
- [ ] Locked boxes within the group do not move (existing lock behavior)
- [ ] Dragging works correctly when multiple groups are selected (each group moves together)
- [ ] Typecheck passes (`npm run build`)
- [ ] Verify in browser using dev-browser skill

### US-003: Properties panel position changes apply to group
**Description:** As a user, I want to change the X, Y, or Z position in the properties panel and have the entire group move by the same amount.

**Acceptance Criteria:**
- [ ] When a grouped box is selected and its X position is changed in the panel, all group members shift by the same X delta
- [ ] Same behavior for Y and Z position changes
- [ ] The delta is calculated as `newValue - oldValue` of the edited box, then applied to all group members
- [ ] If multiple boxes from the same group are selected, the panel shows the first selected box's values (existing behavior)
- [ ] Typecheck passes (`npm run build`)
- [ ] Verify in browser using dev-browser skill

### US-004: Individual dimension editing still works per-box
**Description:** As a user, I want to change width, height, or depth of a single box in a group without affecting other group members' dimensions.

**Acceptance Criteria:**
- [ ] Changing width/height/depth in the properties panel only affects the individual box
- [ ] Other group members' dimensions remain unchanged
- [ ] Typecheck passes (`npm run build`)
- [ ] Verify in browser using dev-browser skill

### US-005: Add keyboard shortcuts for group/ungroup
**Description:** As a user, I want to press Cmd+G to group selected boxes and Cmd+Shift+G to ungroup them.

**Acceptance Criteria:**
- [ ] Cmd+G (or Ctrl+G on non-Mac) groups the currently selected boxes (same as clicking the Group button)
- [ ] Cmd+Shift+G (or Ctrl+Shift+G) ungroups the currently selected boxes
- [ ] Shortcuts only fire when 2+ boxes are selected (group) or selection contains grouped boxes (ungroup)
- [ ] Shortcuts are added to `App.tsx` alongside existing Cmd+Z, Cmd+C, etc.
- [ ] Typecheck passes (`npm run build`)

## Functional Requirements

- FR-1: In `Box3D.tsx` `handlePointerDown`, when a grouped box is clicked, ensure all group members are included in `dragStartPositions` so they all move during drag
- FR-2: In `Box3D.tsx` `handlePointerMove`, the existing multi-drag logic already moves all boxes in `dragStartPositions` by the same delta — verify this works once FR-1 populates the map with group members
- FR-3: In `PropertiesPanel.tsx` `handleUserPositionChange`, calculate delta (`newValue - currentValue`) and dispatch `UPDATE_BOX` for each box in the group with the delta applied to their current position
- FR-4: In `PropertiesPanel.tsx` `handleDimensionChange`, no changes — keep per-individual-box behavior
- FR-5: In `App.tsx`, add keydown handlers for `Cmd+G` → `groupSelectedBoxes()` and `Cmd+Shift+G` → `ungroupSelectedBoxes()`
- FR-6: Ungroup removes `groupId` from all boxes in the selected group(s) — no partial ungroup support needed

## Non-Goals

- No partial ungroup (removing a single box from a group)
- No nested groups (groups within groups)
- No group-level properties (e.g. group name, group material)
- No visual group bounding box beyond the existing colored outline per box

## Technical Considerations

- The `groupId` field and `GROUP_BOXES`/`UNGROUP_BOXES` reducer actions already exist — no data model changes needed
- The multi-drag logic in `Box3D.tsx` already handles moving multiple boxes by a delta — the key change is ensuring `dragStartPositions` includes all group members, not just explicitly selected boxes
- For the properties panel, position changes need a new code path that finds all boxes with the same `groupId` and dispatches updates for each. This may benefit from a new `UPDATE_BOXES_BATCH` action or simply looping `UPDATE_BOX` calls (which will be batched by the undo system from the undo/redo PRD)
- The keyboard shortcuts follow the same pattern as existing ones in `App.tsx` (Cmd+Z, Cmd+C, Cmd+V, Cmd+D)

## Success Metrics

- Dragging any box in a group moves all group members with preserved relative positions
- Changing position in the properties panel shifts the entire group
- Changing dimensions only affects the individual box
- Cmd+G and Cmd+Shift+G work as expected
- No regression in ungrouped box behavior

## Open Questions

- None.
