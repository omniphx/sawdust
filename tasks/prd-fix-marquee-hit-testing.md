# PRD: Fix Marquee Selection Hit Testing

## Introduction

The marquee (drag-to-select) feature only checks if a box's **center point** falls inside the selection rectangle. This means dragging over boxes often fails to select them unless the marquee precisely covers each box's center. The fix is to project each box's full 3D bounding box (all 8 corners) to screen space and check for intersection with the marquee rectangle, so any partial overlap selects the box.

## Goals

- Marquee selects any box it visually overlaps, even partially
- Use screen-space projection of all 8 bounding box corners for accurate hit testing
- Maintain existing shift+marquee behavior (toggle selection)
- No changes to single-click or shift+click selection

## User Stories

### US-001: Project full bounding box to screen space
**Description:** As a developer, I need a function that returns the screen-space bounding rectangle of a box by projecting all 8 corners, so marquee hit testing can check for overlap rather than just center containment.

**Acceptance Criteria:**
- [ ] Create a `getBoxScreenBounds()` function that takes a Box, camera, and container element
- [ ] Projects all 8 corners of the box's 3D bounding box to screen coordinates
- [ ] Returns `{ left, top, right, bottom }` representing the screen-space axis-aligned bounding rectangle
- [ ] Accounts for box position, dimensions, and rotation
- [ ] Typecheck passes (`npm run build`)

### US-002: Update marquee hit testing to use intersection
**Description:** As a user, I want the marquee to select any box it touches so that I don't have to precisely cover each box's center point.

**Acceptance Criteria:**
- [ ] Marquee selects a box if the marquee rectangle and the box's screen-space bounding rectangle overlap at all (intersection test)
- [ ] A box fully inside the marquee is selected
- [ ] A box partially overlapping the marquee edge is selected
- [ ] A box fully outside the marquee is not selected
- [ ] Shift+marquee still toggles selection (add/remove from existing selection)
- [ ] Typecheck passes (`npm run build`)
- [ ] Verify in browser using dev-browser skill

### US-003: Remove old center-point hit test function
**Description:** As a developer, I want to clean up the old `getBoxScreenPosition()` function since it's replaced by the bounding-box approach.

**Acceptance Criteria:**
- [ ] `getBoxScreenPosition()` is removed (or repurposed if used elsewhere)
- [ ] No dead code remains
- [ ] Typecheck passes (`npm run build`)

## Functional Requirements

- FR-1: Add `getBoxScreenBounds(box, camera, container)` that projects all 8 corners of `box.position` + `box.dimensions` through the camera and returns `{ left, top, right, bottom }` in pixel coordinates relative to the container
- FR-2: The 8 corners are computed as all combinations of `(x, x+width)`, `(y, y+height)`, `(z, z+depth)` from the box's position and dimensions
- FR-3: In `handleMarqueeMouseUp`, replace the center-point containment check with an AABB intersection test: two rectangles overlap if `marquee.left <= box.right && marquee.right >= box.left && marquee.top <= box.bottom && marquee.bottom >= box.top`
- FR-4: Shift+marquee toggle behavior remains unchanged (lines 193-206 in current Viewport.tsx)
- FR-5: All changes are in `src/components/viewport/Viewport.tsx`

## Non-Goals

- No "contain" selection mode (only intersection/overlap)
- No per-pixel or mesh-level hit testing
- No changes to single-click or shift+click selection on individual boxes
- No changes to the marquee visual appearance

## Technical Considerations

- The current `getBoxScreenPosition()` (lines 41-57) projects only the center. The new function projects 8 corners and takes the min/max of screen X and Y to form a bounding rect
- Three.js `Vector3.project(camera)` returns normalized device coordinates (-1 to 1), which are then converted to pixel coordinates using the container's dimensions — same math as the existing function
- For boxes with rotation, the 8 corners should be computed in world space accounting for Y-axis rotation. Currently rotation is stored but the existing center-point function ignores it; the new function should handle it correctly
- AABB-AABB intersection in 2D is a simple four-comparison check

## Success Metrics

- Drawing a marquee that visually overlaps any part of a box selects that box
- No false positives (boxes clearly outside the marquee are not selected)
- No regression in shift+marquee toggle behavior

## Open Questions

- None.
