# PRD: Fix Undo/Redo System

## Introduction

The current undo/redo system is buggy: dragging a box creates a history snapshot on every pointer-move frame (so "undo" only reverses one pixel of movement), and multi-box drags dispatch separate `UPDATE_BOX` actions per box (each generating its own snapshot). Dimension changes also require pressing undo twice due to redundant snapshots. This PRD replaces the naive per-dispatch snapshot approach with a batched system that treats each logical user action as a single undo step.

## Goals

- One drag operation (pointer-down → pointer-up) = one undo step, regardless of how many frames or boxes are involved
- Dimension and position edits from the properties panel = one undo step per committed value
- All box-mutating actions (add, delete, duplicate, group, lock, etc.) remain undoable
- History capped at 50 entries to limit memory usage
- History resets on page reload (not persisted to IndexedDB)

## User Stories

### US-001: Add batch history support to the store
**Description:** As a developer, I need the history system to support "begin batch" and "end batch" signals so that multiple dispatches between them collapse into a single undo step.

**Acceptance Criteria:**
- [ ] Add a `HISTORY_BATCH_START` action that saves a pre-batch snapshot
- [ ] Add a `HISTORY_BATCH_END` action that commits the current state as a single history entry (comparing against the pre-batch snapshot; skip if unchanged)
- [ ] While a batch is open, individual `UPDATE_BOX` dispatches do NOT create history entries
- [ ] Non-batch box-mutating actions (`ADD_BOX`, `DELETE_BOX`, `DUPLICATE_BOXES`, etc.) continue to create history entries immediately as before
- [ ] History array is capped at 50 entries (oldest dropped when exceeded)
- [ ] Typecheck passes (`npm run build`)

### US-002: Batch drag operations in Box3D
**Description:** As a user, I want to drag a box (or multi-select drag) and have undo reverse the entire drag in one step.

**Acceptance Criteria:**
- [ ] `handlePointerDown` dispatches `HISTORY_BATCH_START`
- [ ] `handlePointerUp` dispatches `HISTORY_BATCH_END`
- [ ] Dragging a single box and pressing Cmd+Z returns it to its pre-drag position in one step
- [ ] Dragging multiple selected boxes and pressing Cmd+Z returns all of them to pre-drag positions in one step
- [ ] Redo (Cmd+Shift+Z) restores the post-drag position in one step
- [ ] Typecheck passes (`npm run build`)
- [ ] Verify in browser using dev-browser skill

### US-003: Batch properties panel edits
**Description:** As a user, I want to change a dimension or position value in the properties panel and undo it in a single step.

**Acceptance Criteria:**
- [ ] Changing width, height, or depth via the properties panel creates exactly one history entry
- [ ] Changing X, Y, or Z position via the properties panel creates exactly one history entry
- [ ] Pressing undo once fully reverses the change (no double-press needed)
- [ ] Typecheck passes (`npm run build`)
- [ ] Verify in browser using dev-browser skill

### US-004: Verify all other undoable actions still work
**Description:** As a user, I want add, delete, duplicate, paste, group, ungroup, and lock/unlock to each be undoable in one step.

**Acceptance Criteria:**
- [ ] Adding a box then pressing undo removes it
- [ ] Deleting a box then pressing undo restores it
- [ ] Duplicating a box then pressing undo removes the duplicate
- [ ] Grouping boxes then pressing undo ungroups them
- [ ] Locking a box then pressing undo unlocks it
- [ ] Redo works correctly for each of the above
- [ ] Typecheck passes (`npm run build`)
- [ ] Verify in browser using dev-browser skill

## Functional Requirements

- FR-1: Add `HISTORY_BATCH_START` and `HISTORY_BATCH_END` action types to the reducer
- FR-2: Add `historyBatchAnchor: Box[] | null` to `ProjectState` to hold the pre-batch snapshot
- FR-3: When `historyBatchAnchor` is non-null, suppress automatic snapshot creation for `UPDATE_BOX` actions
- FR-4: On `HISTORY_BATCH_END`, compare current boxes to `historyBatchAnchor` — if changed, push one snapshot; clear anchor
- FR-5: Cap `history` array at 50 entries by slicing from the end (drop oldest)
- FR-6: Dispatch `HISTORY_BATCH_START` in `Box3D.handlePointerDown` and `HISTORY_BATCH_END` in `Box3D.handlePointerUp`
- FR-7: Properties panel dimension/position inputs should produce exactly one history entry per committed value change (either via batch or by nature of dispatching a single `UPDATE_BOX`)
- FR-8: `UNDO` and `REDO` actions must deep-clone position and dimensions when restoring (already done, just verify)
- FR-9: History does not persist to IndexedDB — resets to `[initialSnapshot]` on load

## Non-Goals

- No CRDT or operational-transform pattern (unnecessary for single-user)
- No persisting undo history across page reloads
- No undo for non-box state (selection changes, mode switches, snap toggle)
- No undo for material catalog or component library changes

## Technical Considerations

- The batch mechanism is similar to database transactions: `START` opens it, `END` commits it, and only one batch can be open at a time
- If a `HISTORY_BATCH_END` fires without a matching start (e.g. edge case where pointer-up fires without pointer-down), it should be a no-op
- The properties panel inputs already dispatch single `UPDATE_BOX` actions — the "double undo" bug is caused by the current snapshot logic creating entries for every dispatch. After US-001, verify that a single `UPDATE_BOX` outside a batch still creates exactly one entry
- Multi-box drag currently loops `updateBox()` calls — this already works within the batch since all dispatches between START and END collapse

## Success Metrics

- Dragging a box and pressing Cmd+Z once returns it to its original position
- Changing a dimension and pressing Cmd+Z once reverts it
- History never exceeds 50 entries
- No regression in existing add/delete/duplicate/group undo behavior

## Open Questions

- Should the properties panel debounce rapid input changes (e.g. holding arrow key on a number input) into a single undo step? (Could be a follow-up)
