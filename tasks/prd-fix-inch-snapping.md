# PRD: Fix Snap Increment for Inches Unit

## Introduction

When the unit system is set to "inches", the snap-to-grid feature snaps to 1-foot (0.3048m) increments instead of 1-inch (0.0254m) increments. This is because `getSnapIncrement()` in `src/core/units.ts` treats both "feet" and "inches" unit systems identically. The fix is a one-line change to return the correct increment for inches.

## Goals

- Snap to 1-inch increments when the unit system is set to "inches"
- Continue snapping to 1-foot increments when set to "feet"
- Continue snapping to 1-cm increments when set to "metric"
- No changes to grid visuals

## User Stories

### US-001: Fix snap increment for inches
**Description:** As a user working in inches, I want the snap-to-grid to snap to the nearest inch so that my boxes align to inch boundaries.

**Acceptance Criteria:**
- [ ] When unit system is "inches", dragging a box snaps to 1-inch (0.0254m) increments
- [ ] When unit system is "feet", dragging still snaps to 1-foot (0.3048m) increments
- [ ] When unit system is "metric", dragging still snaps to 1-cm (0.01m) increments
- [ ] Typecheck passes (`npm run build`)
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: In `src/core/units.ts`, `getSnapIncrement()` must return `0.0254` (1 inch in meters) when `unitSystem` is `'inches'`
- FR-2: The return value for `'feet'` remains `0.3048` and for `'metric'` remains `0.01`

## Non-Goals

- No changes to grid line spacing or visual appearance
- No changes to snap behavior beyond fixing the increment value
- No new snap increment options (half-inch, quarter-inch, etc.)

## Technical Considerations

- This is a one-line fix in `src/core/units.ts` line 66-69: add a separate branch for `'inches'` returning `0.0254`
- The `snapToGrid()` function that calls `getSnapIncrement()` does not need changes
- The `Viewport.tsx` snap callback already passes unitSystem correctly — only the increment value is wrong

## Success Metrics

- Boxes snap to inch boundaries when dragging in inches mode
- No regression in feet or metric snapping

## Open Questions

- None.
