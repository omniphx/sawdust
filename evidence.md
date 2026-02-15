# Evidence Log

## US-002: Remove auto-stacking from single-box drag

**Date:** 2026-02-15

**Change:** Removed the `stackY` calculation loop from the single-box drag handler in `Box3D.tsx`. Previously, when dragging a single box over another box, the dragged box would jump to the top of the other box (auto-stacking). Now the dragged box maintains its pre-drag Y position throughout the drag.

**Code Change:**
- Removed lines 179-192 in `Box3D.tsx` (the `stackY` loop in the single-box drag else branch)
- Replaced `y: stackY` with `y: box.position.y` in the `onMove` call

**Verification:**
1. `npm run build` passes (TypeScript check + production build)
2. Browser verification: App loads correctly with two boxes visible
3. Screenshot: `us002-verified.png`

## US-003: Remove auto-stacking from multi-box drag

**Date:** 2026-02-15

**Change:** Removed the `stackY` calculation loop from the multi-box drag handler in `Box3D.tsx`. Previously, when dragging multiple selected boxes, each box would auto-stack on top of non-dragged boxes. Now each dragged box maintains its pre-drag Y position (`startPos.y` from `dragStartPositions`).

**Code Change:**
- Removed the `draggedIds` Set and the `stackY` calculation loop (lines 147-171)
- Replaced `y: stackY` with `y: startPos.y` in the updates

**Verification:**
1. `npm run build` passes (TypeScript check + production build)
2. Browser verification: App loads correctly

## US-004 & US-005: Marquee bounding box projection and AABB intersection

**Date:** 2026-02-15

**Change:** Created `getBoxScreenBounds()` function that projects all 8 corners of a box to screen space, returning an axis-aligned bounding rectangle. Updated marquee hit testing to use AABB intersection instead of center-point containment. Removed the old `getBoxScreenPosition()` function.

**Code Change:**
- Added `getBoxScreenBounds()` function in `Viewport.tsx`
- Replaced center-point check in `handleMarqueeMouseUp` with AABB intersection
- Removed `getBoxScreenPosition()` function

**Verification:**
1. `npm run build` passes (TypeScript check + production build)
2. Browser verification: App loads correctly. R3F pointer events don't work in headless Chrome so full interactive marquee testing not possible via Playwright.

## US-006: Add batch history support to the store

**Date:** 2026-02-14

**Change:** Verified that batch history support was already fully implemented in `src/store/projectStore.tsx`. All acceptance criteria met:

- `HISTORY_BATCH_START` and `HISTORY_BATCH_END` action types in reducer
- `historyBatchAnchor: Box[] | null` in `ProjectState`
- `HISTORY_BATCH_START` saves deep clone of current boxes as anchor
- `UPDATE_BOX` suppressed during batch (in `projectReducerWithHistory`)
- `HISTORY_BATCH_END` compares current to anchor, pushes one snapshot if changed
- No-op if `HISTORY_BATCH_END` fires without matching start
- Non-batch actions still create history entries immediately
- History capped at 50 entries

**Verification:**
1. `npm run build` passes (TypeScript check + production build)
2. Code review confirms all acceptance criteria are met in the existing implementation

## US-007: Batch drag operations in Box3D

**Date:** 2026-02-14

**Change:** Added `onHistoryBatchStart` and `onHistoryBatchEnd` props to Box3D, called at drag start and end respectively, so that all UPDATE_BOX dispatches during a drag are collapsed into a single undo step.

**Code Changes:**
- `src/components/viewport/Box3D.tsx`: Added `onHistoryBatchStart`/`onHistoryBatchEnd` to props interface and component destructuring; call `onHistoryBatchStart()` before `setIsDragging(true)` in `handlePointerDown`; call `onHistoryBatchEnd()` in `handlePointerUp` when `isDragging` is true
- `src/components/viewport/Viewport.tsx`: Destructured `historyBatchStart`/`historyBatchEnd` from store; passed them as props to Box3D

**Verification:**
1. `npm run build` passes (TypeScript check + production build)
2. Browser verification: App loads correctly (screenshot: `us007-app-loaded.png`)
3. Note: R3F pointer events don't work in headless Chrome, so drag undo testing not possible via Playwright

## US-008: Fix properties panel undo requiring double press

**Date:** 2026-02-14

**Change:** Verified that properties panel undo already works correctly with a single Cmd+Z press. The DimensionInput component fires `onChange` only on blur (not on each keystroke), so each property change creates exactly one history entry.

**Verification:**
1. `npm run build` passes (TypeScript check + production build)
2. Browser verification via Playwright:
   - Added a 2×4 Lumber box
   - Changed Width from 0.13 to 2.00, pressed Tab to blur
   - Pressed Cmd+Z → Width reverted to 0.13 in one press
   - Pressed Cmd+Shift+Z → Width restored to 2.00 (redo works)
   - Changed X position from 0.00 to 3.00, pressed Tab to blur
   - Pressed Cmd+Z → X position reverted to 0.00 in one press

## US-009: Drag grouped box moves entire group

**Date:** 2026-02-14

**Change:** Modified `handlePointerDown` in Box3D.tsx to include all group members in `dragStartPositions`, not just selected boxes. When a grouped box starts a drag, all boxes with the same `groupId` are merged into the drag set. Locked boxes within the group are excluded from movement.

**Code Changes:**
- `src/components/viewport/Box3D.tsx`: Added `allDragIds` Set that merges `activeSelectedIds` with `groupMemberIds` when the dragged box has a `groupId`. Used `allDragIds` instead of `activeSelectedIds` when populating `dragStartPositions`.

**Verification:**
1. `npm run build` passes (TypeScript check + production build)
2. Browser verification: App loads correctly
3. Note: R3F drag interactions can't be tested in headless Chrome
