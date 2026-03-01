import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { v4 as uuid } from "uuid";
import { Box, Project, UnitSystem, ComponentTemplate } from "../types";
import {
  saveProject,
  loadDefaultProject,
  saveComponent as saveComponentToDb,
  getAllComponents,
  deleteComponent as deleteComponentFromDb,
} from "../core/storage";
import { pickAndParseImportFile } from "../core/export";
import { DEFAULT_MATERIALS, getMaterialById } from "../core/materials";
import { placeComponentBoxes } from "../core/placement";
import { normalizeUnitSystem } from "../core/units";
import { ZERO_ROTATION, rotatePositionAroundAxis, addRotationOnAxis, boxVisualCenter, cornerFromVisualCenter } from "../core/rotation";

interface ProjectState {
  project: Project;
  selectedBoxIds: string[];
  isLoading: boolean;
  mode: "project" | "component-builder";
  currentTemplate: ComponentTemplate | null;
  componentLibrary: ComponentTemplate[];
  clipboard: Box[] | null;
  snapEnabled: boolean;
  toastMessage: string | null;
  history: Box[][];
  historyIndex: number;
  historyBatchAnchor: Box[] | null;
}

type ProjectAction =
  | { type: "SET_PROJECT"; project: Project }
  | { type: "SET_LOADING"; isLoading: boolean }
  | { type: "ADD_BOX"; box: Box }
  | { type: "UPDATE_BOX"; id: string; updates: Partial<Box> }
  | { type: "DELETE_BOX"; id: string }
  | { type: "SELECT_BOXES"; ids: string[] }
  | { type: "TOGGLE_BOX_SELECTION"; id: string }
  | { type: "SET_UNIT_SYSTEM"; unitSystem: UnitSystem }
  | { type: "SET_PROJECT_NAME"; name: string }
  | { type: "START_COMPONENT_BUILDER" }
  | { type: "EDIT_COMPONENT"; template: ComponentTemplate }
  | { type: "SAVE_COMPONENT"; name: string }
  | { type: "CANCEL_COMPONENT_BUILDER" }
  | { type: "PLACE_COMPONENT"; template: ComponentTemplate }
  | { type: "LOAD_COMPONENTS"; components: ComponentTemplate[] }
  | { type: "DELETE_COMPONENT"; id: string }
  | { type: "COPY_BOXES"; boxes: Box[] }
  | { type: "PASTE_BOXES"; boxes: Box[] }
  | { type: "DUPLICATE_BOXES"; boxes: Box[] }
  | { type: "DELETE_SELECTED_BOXES"; ids: string[] }
  | { type: "TOGGLE_SNAP" }
  | { type: "GROUP_BOXES"; ids: string[]; groupId: string }
  | { type: "UNGROUP_BOXES"; ids: string[] }
  | { type: "ROTATE_SELECTED"; ids: string[]; angle: number; axis: 'x' | 'y' | 'z' }
  | { type: "TOGGLE_LOCK"; ids: string[] }
  | { type: "TOGGLE_VISIBILITY"; ids: string[] }
  | { type: "SHOW_TOAST"; message: string }
  | { type: "DISMISS_TOAST" }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "HISTORY_BATCH_START" }
  | { type: "HISTORY_BATCH_END" }
  | { type: "ADD_BOXES"; boxes: Box[] };

function createDefaultProject(): Project {
  return {
    id: uuid(),
    name: "Sauna Project",
    unitSystem: "feet",
    boxes: [],
  };
}

function getActiveBoxes(state: ProjectState): Box[] {
  return state.mode === "component-builder"
    ? (state.currentTemplate?.boxes ?? [])
    : state.project.boxes;
}

function setActiveBoxes(state: ProjectState, boxes: Box[]): ProjectState {
  if (state.mode === "component-builder" && state.currentTemplate) {
    return {
      ...state,
      currentTemplate: { ...state.currentTemplate, boxes },
    };
  }
  return {
    ...state,
    project: { ...state.project, boxes },
  };
}

function projectReducer(
  state: ProjectState,
  action: ProjectAction,
): ProjectState {
  switch (action.type) {
    case "SET_PROJECT": {
      const snapshot = action.project.boxes.map((b) => ({
        ...b,
        position: { ...b.position },
        dimensions: { ...b.dimensions },
        rotation: { ...b.rotation },
        cuts: b.cuts ? b.cuts.map(c => ({ ...c })) : undefined,
        betaMiterCuts: b.betaMiterCuts ? b.betaMiterCuts.map(c => ({ ...c })) : undefined,
      }));
      return {
        ...state,
        project: action.project,
        isLoading: false,
        history: [snapshot],
        historyIndex: 0,
      };
    }

    case "SET_LOADING":
      return { ...state, isLoading: action.isLoading };

    case "ADD_BOX": {
      const boxes = [...getActiveBoxes(state), action.box];
      return setActiveBoxes(state, boxes);
    }

    case "ADD_BOXES": {
      const boxes = [...getActiveBoxes(state), ...action.boxes];
      const newState = setActiveBoxes(state, boxes);
      return { ...newState, selectedBoxIds: action.boxes.map((b) => b.id) };
    }

    case "UPDATE_BOX": {
      const boxes = getActiveBoxes(state).map((box) =>
        box.id === action.id ? { ...box, ...action.updates } : box,
      );
      return setActiveBoxes(state, boxes);
    }

    case "DELETE_BOX": {
      const boxes = getActiveBoxes(state).filter((box) => box.id !== action.id);
      const newState = setActiveBoxes(state, boxes);
      return {
        ...newState,
        selectedBoxIds: state.selectedBoxIds.filter((id) => id !== action.id),
      };
    }

    case "DELETE_SELECTED_BOXES": {
      const idsToDelete = new Set(action.ids);
      const boxes = getActiveBoxes(state).filter(
        (box) => !idsToDelete.has(box.id),
      );
      const newState = setActiveBoxes(state, boxes);
      return {
        ...newState,
        selectedBoxIds: [],
      };
    }

    case "SELECT_BOXES":
      return { ...state, selectedBoxIds: action.ids };

    case "TOGGLE_BOX_SELECTION": {
      const isSelected = state.selectedBoxIds.includes(action.id);
      return {
        ...state,
        selectedBoxIds: isSelected
          ? state.selectedBoxIds.filter((id) => id !== action.id)
          : [...state.selectedBoxIds, action.id],
      };
    }

    case "SET_UNIT_SYSTEM":
      return {
        ...state,
        project: { ...state.project, unitSystem: action.unitSystem },
      };

    case "SET_PROJECT_NAME":
      return {
        ...state,
        project: { ...state.project, name: action.name },
      };

    case "START_COMPONENT_BUILDER":
      return {
        ...state,
        mode: "component-builder",
        selectedBoxIds: [],
        currentTemplate: {
          id: uuid(),
          name: "",
          boxes: [],
          createdAt: Date.now(),
        },
      };

    case "EDIT_COMPONENT":
      return {
        ...state,
        mode: "component-builder",
        selectedBoxIds: [],
        currentTemplate: {
          ...action.template,
          boxes: action.template.boxes.map((b) => ({ ...b })),
        },
      };

    case "SAVE_COMPONENT": {
      if (!state.currentTemplate) return state;
      const saved: ComponentTemplate = {
        ...state.currentTemplate,
        name: action.name,
        createdAt: Date.now(),
      };
      const existingIndex = state.componentLibrary.findIndex(
        (c) => c.id === saved.id,
      );
      const updatedLibrary =
        existingIndex >= 0
          ? state.componentLibrary.map((c) => (c.id === saved.id ? saved : c))
          : [saved, ...state.componentLibrary];
      return {
        ...state,
        mode: "project",
        currentTemplate: null,
        selectedBoxIds: [],
        componentLibrary: updatedLibrary,
      };
    }

    case "CANCEL_COMPONENT_BUILDER":
      return {
        ...state,
        mode: "project",
        currentTemplate: null,
        selectedBoxIds: [],
      };

    case "PLACE_COMPONENT": {
      const newBoxes = placeComponentBoxes(
        action.template,
        state.project.boxes,
      );
      return {
        ...state,
        project: {
          ...state.project,
          boxes: [...state.project.boxes, ...newBoxes],
        },
      };
    }

    case "LOAD_COMPONENTS":
      return { ...state, componentLibrary: action.components };

    case "DELETE_COMPONENT":
      return {
        ...state,
        componentLibrary: state.componentLibrary.filter(
          (c) => c.id !== action.id,
        ),
      };

    case "TOGGLE_SNAP":
      return { ...state, snapEnabled: !state.snapEnabled };

    case "GROUP_BOXES": {
      const idSet = new Set(action.ids);
      const boxes = getActiveBoxes(state).map((box) =>
        idSet.has(box.id) ? { ...box, groupId: action.groupId } : box,
      );
      return setActiveBoxes(state, boxes);
    }

    case "UNGROUP_BOXES": {
      const idSet = new Set(action.ids);
      const boxes = getActiveBoxes(state).map((box) =>
        idSet.has(box.id) ? { ...box, groupId: undefined } : box,
      );
      return setActiveBoxes(state, boxes);
    }

    case "ROTATE_SELECTED": {
      const idSet = new Set(action.ids);
      const allBoxes = getActiveBoxes(state);
      const targetBoxes = allBoxes.filter((b) => idSet.has(b.id) && !b.locked);
      if (targetBoxes.length === 0) return state;

      // Compute visual centers for all target boxes
      const visualCenters = targetBoxes.map((b) =>
        boxVisualCenter(b.position, b.dimensions, b.rotation)
      );

      // Compute group pivot as AABB center of visual centers
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      let minZ = Infinity, maxZ = -Infinity;
      for (const vc of visualCenters) {
        minX = Math.min(minX, vc.x); maxX = Math.max(maxX, vc.x);
        minY = Math.min(minY, vc.y); maxY = Math.max(maxY, vc.y);
        minZ = Math.min(minZ, vc.z); maxZ = Math.max(maxZ, vc.z);
      }
      const pivot = {
        x: (minX + maxX) / 2,
        y: (minY + maxY) / 2,
        z: (minZ + maxZ) / 2,
      };

      const boxes = allBoxes.map((box) => {
        if (!idSet.has(box.id) || box.locked) return box;
        // 1. Get current visual center
        const vc = boxVisualCenter(box.position, box.dimensions, box.rotation);
        // 2. Rotate visual center around pivot
        const newVc = rotatePositionAroundAxis(vc, pivot, action.axis, action.angle);
        // 3. Compute new rotation
        const newRotation = addRotationOnAxis(box.rotation, action.axis, action.angle);
        // 4. Back-compute new corner position
        const newPosition = cornerFromVisualCenter(newVc, box.dimensions, newRotation);
        return { ...box, position: newPosition, rotation: newRotation };
      });
      return setActiveBoxes(state, boxes);
    }

    case "TOGGLE_LOCK": {
      const idSet = new Set(action.ids);
      const targetBoxes = getActiveBoxes(state).filter((b) => idSet.has(b.id));
      // If any are unlocked, lock all; if all locked, unlock all
      const allLocked = targetBoxes.every((b) => b.locked);
      const boxes = getActiveBoxes(state).map((box) =>
        idSet.has(box.id) ? { ...box, locked: !allLocked } : box,
      );
      return setActiveBoxes(state, boxes);
    }

    case "TOGGLE_VISIBILITY": {
      const idSet = new Set(action.ids);
      const targetBoxes = getActiveBoxes(state).filter((b) => idSet.has(b.id));
      const allHidden = targetBoxes.every((b) => b.hidden);
      const boxes = getActiveBoxes(state).map((box) =>
        idSet.has(box.id) ? { ...box, hidden: !allHidden } : box,
      );
      return setActiveBoxes(state, boxes);
    }

    case "SHOW_TOAST":
      return { ...state, toastMessage: action.message };

    case "DISMISS_TOAST":
      return { ...state, toastMessage: null };

    case "UNDO": {
      if (state.historyIndex <= 0) return state;
      const newIndex = state.historyIndex - 1;
      const boxes = state.history[newIndex].map((b) => ({ ...b }));
      return {
        ...setActiveBoxes(state, boxes),
        historyIndex: newIndex,
        selectedBoxIds: [],
      };
    }

    case "REDO": {
      if (state.historyIndex >= state.history.length - 1) return state;
      const newIndex = state.historyIndex + 1;
      const boxes = state.history[newIndex].map((b) => ({ ...b }));
      return {
        ...setActiveBoxes(state, boxes),
        historyIndex: newIndex,
        selectedBoxIds: [],
      };
    }

    case "COPY_BOXES":
      return { ...state, clipboard: action.boxes };

    case "PASTE_BOXES":
    case "DUPLICATE_BOXES": {
      const boxes = [...getActiveBoxes(state), ...action.boxes];
      const newState = setActiveBoxes(state, boxes);
      return { ...newState, selectedBoxIds: action.boxes.map((b) => b.id) };
    }

    case "HISTORY_BATCH_START": {
      const anchor = getActiveBoxes(state).map((b) => ({
        ...b,
        position: { ...b.position },
        dimensions: { ...b.dimensions },
        rotation: { ...b.rotation },
        cuts: b.cuts ? b.cuts.map(c => ({ ...c })) : undefined,
        betaMiterCuts: b.betaMiterCuts ? b.betaMiterCuts.map(c => ({ ...c })) : undefined,
      }));
      return { ...state, historyBatchAnchor: anchor };
    }

    case "HISTORY_BATCH_END": {
      if (!state.historyBatchAnchor) return state;
      const currentBoxes = getActiveBoxes(state);
      const anchorStr = JSON.stringify(state.historyBatchAnchor);
      const currentStr = JSON.stringify(currentBoxes);
      if (anchorStr !== currentStr) {
        const snapshot = currentBoxes.map((b) => ({
          ...b,
          position: { ...b.position },
          dimensions: { ...b.dimensions },
          rotation: { ...b.rotation },
          cuts: b.cuts ? b.cuts.map(c => ({ ...c })) : undefined,
          betaMiterCuts: b.betaMiterCuts ? b.betaMiterCuts.map(c => ({ ...c })) : undefined,
        }));
        // Rewind history to anchor point, push anchor as "before" and current as "after"
        const anchorSnapshot = state.historyBatchAnchor;
        const history = [...state.history.slice(0, state.historyIndex + 1)];
        // Replace the last entry with the anchor (pre-batch state), then add current
        if (history.length > 0 && state.historyIndex >= 0) {
          history[state.historyIndex] = anchorSnapshot;
        }
        history.push(snapshot);
        // Cap at 50
        const capped =
          history.length > 50 ? history.slice(history.length - 50) : history;
        return {
          ...state,
          historyBatchAnchor: null,
          history: capped,
          historyIndex: capped.length - 1,
        };
      }
      return { ...state, historyBatchAnchor: null };
    }

    default:
      return state;
  }
}

// Actions that mutate boxes and should be tracked in undo history
const BOX_MUTATING_ACTIONS = new Set<ProjectAction["type"]>([
  "ADD_BOX",
  "ADD_BOXES",
  "DELETE_BOX",
  "UPDATE_BOX",
  "DUPLICATE_BOXES",
  "PASTE_BOXES",
  "DELETE_SELECTED_BOXES",
  "ROTATE_SELECTED",
  "GROUP_BOXES",
  "UNGROUP_BOXES",
  "TOGGLE_LOCK",
  "TOGGLE_VISIBILITY",
  "PLACE_COMPONENT",
]);

const MAX_HISTORY = 50;

function projectReducerWithHistory(
  state: ProjectState,
  action: ProjectAction,
): ProjectState {
  const newState = projectReducer(state, action);

  // Only track history for box-mutating actions, and only if boxes actually changed
  if (BOX_MUTATING_ACTIONS.has(action.type)) {
    // Suppress history during batch (UPDATE_BOX calls during drag)
    if (state.historyBatchAnchor !== null && action.type === "UPDATE_BOX") {
      return newState;
    }

    const oldBoxes = getActiveBoxes(state);
    const newBoxes = getActiveBoxes(newState);
    if (oldBoxes !== newBoxes) {
      // Deep clone for snapshot
      const snapshot = newBoxes.map((b) => ({
        ...b,
        position: { ...b.position },
        dimensions: { ...b.dimensions },
        rotation: { ...b.rotation },
        cuts: b.cuts ? b.cuts.map(c => ({ ...c })) : undefined,
        betaMiterCuts: b.betaMiterCuts ? b.betaMiterCuts.map(c => ({ ...c })) : undefined,
      }));
      // Truncate any redo history beyond current index
      const history = [
        ...state.history.slice(0, state.historyIndex + 1),
        snapshot,
      ];
      // Cap at MAX_HISTORY
      const capped =
        history.length > MAX_HISTORY
          ? history.slice(history.length - MAX_HISTORY)
          : history;
      return {
        ...newState,
        history: capped,
        historyIndex: capped.length - 1,
      };
    }
  }

  return newState;
}

interface ProjectContextValue {
  state: ProjectState;
  addBox: (materialId?: string) => void;
  addBoxes: (boxes: Box[]) => void;
  updateBox: (id: string, updates: Partial<Box>) => void;
  deleteBox: (id: string) => void;
  deleteSelectedBoxes: () => void;
  selectBoxes: (ids: string[]) => void;
  toggleBoxSelection: (id: string) => void;
  setUnitSystem: (unitSystem: UnitSystem) => void;
  setProjectName: (name: string) => void;
  getSelectedBox: () => Box | undefined;
  getSelectedBoxes: () => Box[];
  duplicateSelectedBoxes: () => void;
  copySelectedBoxes: () => void;
  pasteBoxes: () => void;
  startComponentBuilder: () => void;
  editComponent: (template: ComponentTemplate) => void;
  saveComponent: (name: string) => void;
  createComponentFromSelected: (name: string) => void;
  cancelComponentBuilder: () => void;
  placeComponent: (template: ComponentTemplate) => void;
  deleteComponentTemplate: (id: string) => void;
  toggleSnap: () => void;
  groupSelectedBoxes: () => void;
  ungroupSelectedBoxes: () => void;
  rotateSelectedBoxes: (angle: number, axis?: 'x' | 'y' | 'z') => void;
  toggleLockSelectedBoxes: () => void;
  toggleVisibilitySelectedBoxes: () => void;
  showToast: (message: string) => void;
  dismissToast: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  importProject: () => void;
  historyBatchStart: () => void;
  historyBatchEnd: () => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(projectReducerWithHistory, {
    project: createDefaultProject(),
    selectedBoxIds: [],
    isLoading: true,
    mode: "project",
    currentTemplate: null,
    componentLibrary: [],
    clipboard: null,
    snapEnabled: true,
    toastMessage: null,
    history: [[]],
    historyIndex: 0,
    historyBatchAnchor: null,
  });

  // Load project and components from IndexedDB on mount
  useEffect(() => {
    Promise.all([loadDefaultProject(), getAllComponents()]).then(
      ([saved, components]) => {
        if (saved) {
          // Normalize legacy unit system values (e.g. 'imperial' → 'feet')
          saved.unitSystem = normalizeUnitSystem(saved.unitSystem);
          dispatch({ type: "SET_PROJECT", project: saved });
        } else {
          dispatch({ type: "SET_LOADING", isLoading: false });
        }
        dispatch({ type: "LOAD_COMPONENTS", components });
      },
    );
  }, []);

  // Auto-save project on changes
  useEffect(() => {
    if (!state.isLoading) {
      saveProject(state.project);
    }
  }, [state.project, state.isLoading]);

  const addBox = useCallback(
    (materialId?: string) => {
      const boxes = getActiveBoxes(state);

      // Cycle through materials so each new box gets a different color
      if (!materialId) {
        const materialIds = DEFAULT_MATERIALS.map((m) => m.id);
        const usedCounts = new Map<string, number>();
        for (const b of boxes) {
          usedCounts.set(b.materialId, (usedCounts.get(b.materialId) ?? 0) + 1);
        }
        let minCount = Infinity;
        let picked = materialIds[0];
        for (const id of materialIds) {
          const count = usedCounts.get(id) ?? 0;
          if (count < minCount) {
            minCount = count;
            picked = id;
          }
        }
        materialId = picked;
      }

      // Use material's actual dimensions if available
      const material = getMaterialById(materialId);
      const defaultDim = material?.defaultDimensions ?? {
        width: 1,
        height: 1,
        depth: 1,
      };
      let posX = 0;
      const posZ = 0;
      const spacing = 0.25;

      // Position is the bottom-left-front corner, so box extends from (x,y,z) to (x+w,y+h,z+d)
      const isOverlapping = (x: number, z: number) => {
        for (const b of boxes) {
          if (
            x < b.position.x + b.dimensions.width + spacing &&
            b.position.x < x + defaultDim.width + spacing &&
            z < b.position.z + b.dimensions.depth + spacing &&
            b.position.z < z + defaultDim.depth + spacing
          ) {
            return true;
          }
        }
        return false;
      };

      while (isOverlapping(posX, posZ)) {
        posX += defaultDim.width + spacing;
      }

      const box: Box = {
        id: uuid(),
        position: { x: posX, y: 0, z: posZ },
        dimensions: defaultDim,
        rotation: { ...ZERO_ROTATION },
        materialId,
        cuts: [{ id: uuid(), face: "left", angle: 45 }],
      };
      dispatch({ type: "ADD_BOX", box });
      dispatch({ type: "SELECT_BOXES", ids: [box.id] });
    },
    [state],
  );

  const addBoxes = useCallback((boxes: Box[]) => {
    dispatch({ type: "ADD_BOXES", boxes });
  }, []);

  const updateBox = useCallback((id: string, updates: Partial<Box>) => {
    dispatch({ type: "UPDATE_BOX", id, updates });
  }, []);

  const deleteBox = useCallback((id: string) => {
    dispatch({ type: "DELETE_BOX", id });
  }, []);

  const selectBoxes = useCallback((ids: string[]) => {
    dispatch({ type: "SELECT_BOXES", ids });
  }, []);

  const toggleBoxSelection = useCallback((id: string) => {
    dispatch({ type: "TOGGLE_BOX_SELECTION", id });
  }, []);

  const setUnitSystem = useCallback((unitSystem: UnitSystem) => {
    dispatch({ type: "SET_UNIT_SYSTEM", unitSystem });
  }, []);

  const setProjectName = useCallback((name: string) => {
    dispatch({ type: "SET_PROJECT_NAME", name });
  }, []);

  const getSelectedBox = useCallback(() => {
    const boxes = getActiveBoxes(state);
    return boxes.find((box) => box.id === state.selectedBoxIds[0]);
  }, [state]);

  const getSelectedBoxes = useCallback(() => {
    const boxes = getActiveBoxes(state);
    const idSet = new Set(state.selectedBoxIds);
    return boxes.filter((box) => idSet.has(box.id));
  }, [state]);

  const duplicateBoxGroup = useCallback(
    (sourceBoxes: Box[], existingBoxes: Box[]) => {
      const spacing = 0.25;

      // Compute bounding box of the group
      let minX = Infinity,
        minZ = Infinity,
        maxX = -Infinity,
        maxZ = -Infinity;
      for (const b of sourceBoxes) {
        minX = Math.min(minX, b.position.x);
        minZ = Math.min(minZ, b.position.z);
        maxX = Math.max(maxX, b.position.x + b.dimensions.width);
        maxZ = Math.max(maxZ, b.position.z + b.dimensions.depth);
      }
      const groupWidth = maxX - minX;

      // Find non-overlapping position for the entire group
      let offsetX = maxX + spacing - minX; // Start just to the right of the group
      const offsetZ = 0;

      const isGroupOverlapping = (dx: number, dz: number) => {
        for (const src of sourceBoxes) {
          const nx = src.position.x + dx;
          const nz = src.position.z + dz;
          for (const b of existingBoxes) {
            if (
              nx < b.position.x + b.dimensions.width + spacing &&
              b.position.x < nx + src.dimensions.width + spacing &&
              nz < b.position.z + b.dimensions.depth + spacing &&
              b.position.z < nz + src.dimensions.depth + spacing
            ) {
              return true;
            }
          }
        }
        return false;
      };

      while (isGroupOverlapping(offsetX, offsetZ)) {
        offsetX += groupWidth + spacing;
      }

      // Map old groupIds to new groupIds so duplicated groups stay grouped
      const groupIdMap = new Map<string, string>();
      for (const source of sourceBoxes) {
        if (source.groupId && !groupIdMap.has(source.groupId)) {
          groupIdMap.set(source.groupId, uuid());
        }
      }

      return sourceBoxes.map((source) => ({
        ...source,
        id: uuid(),
        groupId: source.groupId ? groupIdMap.get(source.groupId) : undefined,
        position: {
          x: source.position.x + offsetX,
          y: source.position.y,
          z: source.position.z + offsetZ,
        },
        label: source.label ? `${source.label} (copy)` : undefined,
        cuts: source.cuts?.map(c => ({ ...c, id: uuid() })),
        betaMiterCuts: source.betaMiterCuts?.map(c => ({ ...c, id: uuid() })),
      }));
    },
    [],
  );

  const duplicateSelectedBoxes = useCallback(() => {
    const boxes = getActiveBoxes(state);
    const selected = boxes.filter((b) => state.selectedBoxIds.includes(b.id));
    if (selected.length === 0) return;

    const newBoxes = duplicateBoxGroup(selected, boxes);
    dispatch({ type: "DUPLICATE_BOXES", boxes: newBoxes });
  }, [state]);

  const copySelectedBoxes = useCallback(() => {
    const boxes = getActiveBoxes(state);
    const selected = boxes.filter((b) => state.selectedBoxIds.includes(b.id));
    if (selected.length === 0) return;
    dispatch({ type: "COPY_BOXES", boxes: selected });
  }, [state]);

  const pasteBoxes = useCallback(() => {
    if (!state.clipboard || state.clipboard.length === 0) return;
    const boxes = getActiveBoxes(state);
    const newBoxes = duplicateBoxGroup(state.clipboard, boxes);
    dispatch({ type: "PASTE_BOXES", boxes: newBoxes });
  }, [state]);

  const deleteSelectedBoxes = useCallback(() => {
    if (state.selectedBoxIds.length === 0) return;
    const boxes = getActiveBoxes(state);
    const selectedBoxes = boxes.filter((b) =>
      state.selectedBoxIds.includes(b.id),
    );
    const unlocked = selectedBoxes.filter((b) => !b.locked);
    const lockedCount = selectedBoxes.length - unlocked.length;

    if (unlocked.length === 0) {
      dispatch({
        type: "SHOW_TOAST",
        message: `Cannot delete ${lockedCount} locked item${lockedCount > 1 ? "s" : ""}`,
      });
      return;
    }

    if (lockedCount > 0) {
      dispatch({
        type: "SHOW_TOAST",
        message: `${lockedCount} locked item${lockedCount > 1 ? "s" : ""} skipped`,
      });
    }

    dispatch({ type: "DELETE_SELECTED_BOXES", ids: unlocked.map((b) => b.id) });
  }, [state]);

  const startComponentBuilder = useCallback(() => {
    dispatch({ type: "START_COMPONENT_BUILDER" });
  }, []);

  const editComponent = useCallback((template: ComponentTemplate) => {
    dispatch({ type: "EDIT_COMPONENT", template });
  }, []);

  const createComponentFromSelected = useCallback(
    (name: string) => {
      if (state.selectedBoxIds.length === 0) return;
      const trimmed = name.trim() || "Untitled Component";

      // Build the template here so we can persist it
      const selectedBoxes = state.project.boxes.filter((b) =>
        state.selectedBoxIds.includes(b.id),
      );
      let minX = Infinity, minY = Infinity, minZ = Infinity;
      for (const b of selectedBoxes) {
        minX = Math.min(minX, b.position.x);
        minY = Math.min(minY, b.position.y);
        minZ = Math.min(minZ, b.position.z);
      }
      const templateBoxes = selectedBoxes.map((b) => ({
        ...b,
        groupId: undefined,
        position: {
          x: b.position.x - minX,
          y: b.position.y - minY,
          z: b.position.z - minZ,
        },
      }));
      const template: ComponentTemplate = {
        id: uuid(),
        name: trimmed,
        boxes: templateBoxes,
        createdAt: Date.now(),
      };
      saveComponentToDb(template);
      dispatch({ type: "LOAD_COMPONENTS", components: [template, ...state.componentLibrary] });
      dispatch({ type: "SELECT_BOXES", ids: [] });
    },
    [state.selectedBoxIds, state.project.boxes, state.componentLibrary],
  );

  const saveComponentAction = useCallback(
    (name: string) => {
      if (!state.currentTemplate) return;
      const template: ComponentTemplate = {
        ...state.currentTemplate,
        name,
        createdAt: Date.now(),
      };
      saveComponentToDb(template);
      dispatch({ type: "SAVE_COMPONENT", name });
    },
    [state.currentTemplate],
  );

  const cancelComponentBuilder = useCallback(() => {
    dispatch({ type: "CANCEL_COMPONENT_BUILDER" });
  }, []);

  const placeComponent = useCallback((template: ComponentTemplate) => {
    dispatch({ type: "PLACE_COMPONENT", template });
  }, []);

  const deleteComponentTemplate = useCallback((id: string) => {
    deleteComponentFromDb(id);
    dispatch({ type: "DELETE_COMPONENT", id });
  }, []);

  const toggleSnap = useCallback(() => {
    dispatch({ type: "TOGGLE_SNAP" });
  }, []);

  const groupSelectedBoxes = useCallback(() => {
    if (state.selectedBoxIds.length < 2) return;
    dispatch({
      type: "GROUP_BOXES",
      ids: state.selectedBoxIds,
      groupId: uuid(),
    });
  }, [state.selectedBoxIds]);

  const ungroupSelectedBoxes = useCallback(() => {
    if (state.selectedBoxIds.length === 0) return;
    dispatch({ type: "UNGROUP_BOXES", ids: state.selectedBoxIds });
  }, [state.selectedBoxIds]);

  const rotateSelectedBoxes = useCallback((angle: number, axis: 'x' | 'y' | 'z' = 'y') => {
    if (state.selectedBoxIds.length === 0) return;
    dispatch({ type: "ROTATE_SELECTED", ids: state.selectedBoxIds, angle, axis });
  }, [state.selectedBoxIds]);

  const toggleLockSelectedBoxes = useCallback(() => {
    if (state.selectedBoxIds.length === 0) return;
    dispatch({ type: "TOGGLE_LOCK", ids: state.selectedBoxIds });
  }, [state.selectedBoxIds]);

  const toggleVisibilitySelectedBoxes = useCallback(() => {
    if (state.selectedBoxIds.length === 0) return;
    dispatch({ type: "TOGGLE_VISIBILITY", ids: state.selectedBoxIds });
  }, [state.selectedBoxIds]);

  const showToast = useCallback((message: string) => {
    dispatch({ type: "SHOW_TOAST", message });
  }, []);

  const dismissToast = useCallback(() => {
    dispatch({ type: "DISMISS_TOAST" });
  }, []);

  const undo = useCallback(() => {
    dispatch({ type: "UNDO" });
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: "REDO" });
  }, []);

  const historyBatchStart = useCallback(() => {
    dispatch({ type: "HISTORY_BATCH_START" });
  }, []);

  const historyBatchEnd = useCallback(() => {
    dispatch({ type: "HISTORY_BATCH_END" });
  }, []);

  const importProjectAction = useCallback(() => {
    pickAndParseImportFile()
      .then((data) => {
        dispatch({ type: "SET_PROJECT", project: data.project });
        saveProject(data.project);

        const components = data.components ?? [];
        for (const c of components) {
          saveComponentToDb(c);
        }
        dispatch({ type: "LOAD_COMPONENTS", components });
      })
      .catch((err) => {
        if (err?.message !== "No file selected") {
          dispatch({ type: "SHOW_TOAST", message: err?.message ?? "Import failed" });
        }
      });
  }, []);

  const canUndo = state.historyIndex > 0;
  const canRedo = state.historyIndex < state.history.length - 1;

  return (
    <ProjectContext.Provider
      value={{
        state,
        addBox,
        addBoxes,
        updateBox,
        deleteBox,
        deleteSelectedBoxes,
        selectBoxes,
        toggleBoxSelection,
        setUnitSystem,
        setProjectName,
        getSelectedBox,
        getSelectedBoxes,
        duplicateSelectedBoxes,
        copySelectedBoxes,
        pasteBoxes,
        startComponentBuilder,
        editComponent,
        saveComponent: saveComponentAction,
        createComponentFromSelected,
        cancelComponentBuilder,
        placeComponent,
        deleteComponentTemplate,
        importProject: importProjectAction,
        toggleSnap,
        groupSelectedBoxes,
        ungroupSelectedBoxes,
        rotateSelectedBoxes,
        toggleLockSelectedBoxes,
        toggleVisibilitySelectedBoxes,
        showToast,
        dismissToast,
        undo,
        redo,
        canUndo,
        canRedo,
        historyBatchStart,
        historyBatchEnd,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjectStore() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error("useProjectStore must be used within a ProjectProvider");
  }
  return context;
}
