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
