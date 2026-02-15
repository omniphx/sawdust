# PRD: Remove Auto-Stacking on Drag

## Introduction

When dragging a box over another box, the app automatically lifts the dragged box on top of the existing one (auto-stacking). This behavior is frustrating and unexpected — users want boxes to stay at their current Y position during drag. This PRD removes the auto-stacking calculation from drag operations while preserving the ability to manually set Y position via the properties panel.

## Goals

- Remove auto-stacking behavior during single-box and multi-box drag operations
- Boxes remain at their current Y position (or Y=0 for ground-level boxes) when dragged
- Preserve manual Y position editing via the properties panel
- Keep the change minimal — only modify the drag handler

## User Stories

### US-001: Remove auto-stacking from single-box drag
**Description:** As a user, I want to drag a box without it jumping on top of other boxes so that I can freely position objects on the workspace.

**Acceptance Criteria:**
- [ ] Dragging a single box over another box does NOT change the dragged box's Y position
- [ ] The dragged box stays at its pre-drag Y position throughout the drag
- [ ] Boxes can freely overlap on the XZ plane
- [ ] Typecheck passes (`npm run build`)
- [ ] Verify in browser using dev-browser skill

### US-002: Remove auto-stacking from multi-box drag
**Description:** As a user, I want to drag multiple selected boxes without any of them jumping on top of other boxes.

**Acceptance Criteria:**
- [ ] Dragging multiple selected boxes over other boxes does NOT change any dragged box's Y position
- [ ] Each dragged box maintains its pre-drag Y position throughout the drag
- [ ] Typecheck passes (`npm run build`)
- [ ] Verify in browser using dev-browser skill

### US-003: Verify manual Y position still works
**Description:** As a user, I still want to set a box's Y position manually via the properties panel.

**Acceptance Criteria:**
- [ ] Changing Y position in the properties panel still moves the box vertically
- [ ] The manually set Y position persists after subsequent XZ drags
- [ ] Typecheck passes (`npm run build`)
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: In `Box3D.tsx` single-box drag handler (~line 177-194), remove the `stackY` calculation loop and use the box's current `position.y` instead
- FR-2: In `Box3D.tsx` multi-box drag handler (~line 142-176), remove the `stackY` calculation loop and use each box's `startPos.y` (from `dragStartPositions`) instead
- FR-3: The `onMove` and `onMoveSelected` callbacks continue to receive `{ x, y, z }` positions — only the Y value source changes
- FR-4: No changes to the properties panel, reducer, or any other file

## Non-Goals

- No collision detection or prevention on the XZ plane
- No physics-based stacking or gravity
- No changes to how new boxes are initially placed (they still start at Y=0)
- No changes to the properties panel Y input behavior

## Technical Considerations

- The change is isolated to `src/components/viewport/Box3D.tsx` in two code blocks within `handlePointerMove`
- For single-box drag: replace `stackY` with `box.position.y`
- For multi-box drag: replace `stackY` with `startPos.y` (the Y from `dragStartPositions` map, which already captures each box's initial position)
- The `dragStartPositions` map already stores full `{ x, y, z }` positions, so the Y is readily available

## Success Metrics

- Dragging a box over another box no longer causes any vertical movement
- Manual Y positioning via properties panel still works
- No regressions in drag behavior (snapping, multi-select drag)

## Open Questions

- None — this is a straightforward removal of existing behavior.
