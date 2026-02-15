import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { v4 as uuid } from 'uuid';
import { Box, Project, UnitSystem, ComponentTemplate } from '../types';
import {
  saveProject,
  loadDefaultProject,
  saveComponent as saveComponentToDb,
  getAllComponents,
  deleteComponent as deleteComponentFromDb,
} from '../core/storage';
import { DEFAULT_MATERIALS, getMaterialById } from '../core/materials';
import { placeComponentBoxes } from '../core/placement';
import { normalizeUnitSystem } from '../core/units';

interface ProjectState {
  project: Project;
  selectedBoxIds: string[];
  isLoading: boolean;
  mode: 'project' | 'component-builder';
  currentTemplate: ComponentTemplate | null;
  componentLibrary: ComponentTemplate[];
  clipboard: Box[] | null;
  snapEnabled: boolean;
}

type ProjectAction =
  | { type: 'SET_PROJECT'; project: Project }
  | { type: 'SET_LOADING'; isLoading: boolean }
  | { type: 'ADD_BOX'; box: Box }
  | { type: 'UPDATE_BOX'; id: string; updates: Partial<Box> }
  | { type: 'DELETE_BOX'; id: string }
  | { type: 'SELECT_BOXES'; ids: string[] }
  | { type: 'TOGGLE_BOX_SELECTION'; id: string }
  | { type: 'SET_UNIT_SYSTEM'; unitSystem: UnitSystem }
  | { type: 'SET_PROJECT_NAME'; name: string }
  | { type: 'START_COMPONENT_BUILDER' }
  | { type: 'SAVE_COMPONENT'; name: string }
  | { type: 'CANCEL_COMPONENT_BUILDER' }
  | { type: 'PLACE_COMPONENT'; template: ComponentTemplate }
  | { type: 'LOAD_COMPONENTS'; components: ComponentTemplate[] }
  | { type: 'DELETE_COMPONENT'; id: string }
  | { type: 'COPY_BOXES'; boxes: Box[] }
  | { type: 'PASTE_BOXES'; boxes: Box[] }
  | { type: 'DUPLICATE_BOXES'; boxes: Box[] }
  | { type: 'DELETE_SELECTED_BOXES'; ids: string[] }
  | { type: 'TOGGLE_SNAP' }
  | { type: 'GROUP_BOXES'; ids: string[]; groupId: string }
  | { type: 'UNGROUP_BOXES'; ids: string[] }
  | { type: 'TOGGLE_LOCK'; ids: string[] };

function createDefaultProject(): Project {
  return {
    id: uuid(),
    name: 'Sauna Project',
    unitSystem: 'feet',
    boxes: [],
  };
}

function getActiveBoxes(state: ProjectState): Box[] {
  return state.mode === 'component-builder'
    ? (state.currentTemplate?.boxes ?? [])
    : state.project.boxes;
}

function setActiveBoxes(state: ProjectState, boxes: Box[]): ProjectState {
  if (state.mode === 'component-builder' && state.currentTemplate) {
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

function projectReducer(state: ProjectState, action: ProjectAction): ProjectState {
  switch (action.type) {
    case 'SET_PROJECT':
      return { ...state, project: action.project, isLoading: false };

    case 'SET_LOADING':
      return { ...state, isLoading: action.isLoading };

    case 'ADD_BOX': {
      const boxes = [...getActiveBoxes(state), action.box];
      return setActiveBoxes(state, boxes);
    }

    case 'UPDATE_BOX': {
      const boxes = getActiveBoxes(state).map((box) =>
        box.id === action.id ? { ...box, ...action.updates } : box
      );
      return setActiveBoxes(state, boxes);
    }

    case 'DELETE_BOX': {
      const boxes = getActiveBoxes(state).filter((box) => box.id !== action.id);
      const newState = setActiveBoxes(state, boxes);
      return {
        ...newState,
        selectedBoxIds: state.selectedBoxIds.filter((id) => id !== action.id),
      };
    }

    case 'DELETE_SELECTED_BOXES': {
      const idsToDelete = new Set(action.ids);
      const boxes = getActiveBoxes(state).filter((box) => !idsToDelete.has(box.id));
      const newState = setActiveBoxes(state, boxes);
      return {
        ...newState,
        selectedBoxIds: [],
      };
    }

    case 'SELECT_BOXES':
      return { ...state, selectedBoxIds: action.ids };

    case 'TOGGLE_BOX_SELECTION': {
      const isSelected = state.selectedBoxIds.includes(action.id);
      return {
        ...state,
        selectedBoxIds: isSelected
          ? state.selectedBoxIds.filter((id) => id !== action.id)
          : [...state.selectedBoxIds, action.id],
      };
    }

    case 'SET_UNIT_SYSTEM':
      return {
        ...state,
        project: { ...state.project, unitSystem: action.unitSystem },
      };

    case 'SET_PROJECT_NAME':
      return {
        ...state,
        project: { ...state.project, name: action.name },
      };

    case 'START_COMPONENT_BUILDER':
      return {
        ...state,
        mode: 'component-builder',
        selectedBoxIds: [],
        currentTemplate: {
          id: uuid(),
          name: '',
          boxes: [],
          createdAt: Date.now(),
        },
      };

    case 'SAVE_COMPONENT': {
      if (!state.currentTemplate) return state;
      const saved: ComponentTemplate = {
        ...state.currentTemplate,
        name: action.name,
        createdAt: Date.now(),
      };
      return {
        ...state,
        mode: 'project',
        currentTemplate: null,
        selectedBoxIds: [],
        componentLibrary: [saved, ...state.componentLibrary],
      };
    }

    case 'CANCEL_COMPONENT_BUILDER':
      return {
        ...state,
        mode: 'project',
        currentTemplate: null,
        selectedBoxIds: [],
      };

    case 'PLACE_COMPONENT': {
      const newBoxes = placeComponentBoxes(action.template, state.project.boxes);
      return {
        ...state,
        project: {
          ...state.project,
          boxes: [...state.project.boxes, ...newBoxes],
        },
      };
    }

    case 'LOAD_COMPONENTS':
      return { ...state, componentLibrary: action.components };

    case 'DELETE_COMPONENT':
      return {
        ...state,
        componentLibrary: state.componentLibrary.filter((c) => c.id !== action.id),
      };

    case 'TOGGLE_SNAP':
      return { ...state, snapEnabled: !state.snapEnabled };

    case 'GROUP_BOXES': {
      const idSet = new Set(action.ids);
      const boxes = getActiveBoxes(state).map((box) =>
        idSet.has(box.id) ? { ...box, groupId: action.groupId } : box
      );
      return setActiveBoxes(state, boxes);
    }

    case 'UNGROUP_BOXES': {
      const idSet = new Set(action.ids);
      const boxes = getActiveBoxes(state).map((box) =>
        idSet.has(box.id) ? { ...box, groupId: undefined } : box
      );
      return setActiveBoxes(state, boxes);
    }

    case 'TOGGLE_LOCK': {
      const idSet = new Set(action.ids);
      const targetBoxes = getActiveBoxes(state).filter((b) => idSet.has(b.id));
      // If any are unlocked, lock all; if all locked, unlock all
      const allLocked = targetBoxes.every((b) => b.locked);
      const boxes = getActiveBoxes(state).map((box) =>
        idSet.has(box.id) ? { ...box, locked: !allLocked } : box
      );
      return setActiveBoxes(state, boxes);
    }

    case 'COPY_BOXES':
      return { ...state, clipboard: action.boxes };

    case 'PASTE_BOXES':
    case 'DUPLICATE_BOXES': {
      const boxes = [...getActiveBoxes(state), ...action.boxes];
      const newState = setActiveBoxes(state, boxes);
      return { ...newState, selectedBoxIds: action.boxes.map((b) => b.id) };
    }

    default:
      return state;
  }
}

interface ProjectContextValue {
  state: ProjectState;
  addBox: (materialId?: string) => void;
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
  saveComponent: (name: string) => void;
  cancelComponentBuilder: () => void;
  placeComponent: (template: ComponentTemplate) => void;
  deleteComponentTemplate: (id: string) => void;
  toggleSnap: () => void;
  groupSelectedBoxes: () => void;
  ungroupSelectedBoxes: () => void;
  toggleLockSelectedBoxes: () => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(projectReducer, {
    project: createDefaultProject(),
    selectedBoxIds: [],
    isLoading: true,
    mode: 'project',
    currentTemplate: null,
    componentLibrary: [],
    clipboard: null,
    snapEnabled: true,
  });

  // Load project and components from IndexedDB on mount
  useEffect(() => {
    Promise.all([loadDefaultProject(), getAllComponents()]).then(
      ([saved, components]) => {
        if (saved) {
          // Normalize legacy unit system values (e.g. 'imperial' → 'feet')
          saved.unitSystem = normalizeUnitSystem(saved.unitSystem);
          dispatch({ type: 'SET_PROJECT', project: saved });
        } else {
          dispatch({ type: 'SET_LOADING', isLoading: false });
        }
        dispatch({ type: 'LOAD_COMPONENTS', components });
      }
    );
  }, []);

  // Auto-save project on changes
  useEffect(() => {
    if (!state.isLoading) {
      saveProject(state.project);
    }
  }, [state.project, state.isLoading]);

  const addBox = useCallback((materialId?: string) => {
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
    const defaultDim = material?.defaultDimensions ?? { width: 1, height: 1, depth: 1 };
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
      rotation: 0,
      materialId,
    };
    dispatch({ type: 'ADD_BOX', box });
    dispatch({ type: 'SELECT_BOXES', ids: [box.id] });
  }, [state]);

  const updateBox = useCallback((id: string, updates: Partial<Box>) => {
    dispatch({ type: 'UPDATE_BOX', id, updates });
  }, []);

  const deleteBox = useCallback((id: string) => {
    dispatch({ type: 'DELETE_BOX', id });
  }, []);

  const selectBoxes = useCallback((ids: string[]) => {
    dispatch({ type: 'SELECT_BOXES', ids });
  }, []);

  const toggleBoxSelection = useCallback((id: string) => {
    dispatch({ type: 'TOGGLE_BOX_SELECTION', id });
  }, []);

  const setUnitSystem = useCallback((unitSystem: UnitSystem) => {
    dispatch({ type: 'SET_UNIT_SYSTEM', unitSystem });
  }, []);

  const setProjectName = useCallback((name: string) => {
    dispatch({ type: 'SET_PROJECT_NAME', name });
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

  const duplicateBoxGroup = useCallback((sourceBoxes: Box[], existingBoxes: Box[]) => {
    const spacing = 0.25;

    // Compute bounding box of the group
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
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
    }));
  }, []);

  const duplicateSelectedBoxes = useCallback(() => {
    const boxes = getActiveBoxes(state);
    const selected = boxes.filter((b) => state.selectedBoxIds.includes(b.id));
    if (selected.length === 0) return;

    const newBoxes = duplicateBoxGroup(selected, boxes);
    dispatch({ type: 'DUPLICATE_BOXES', boxes: newBoxes });
  }, [state]);

  const copySelectedBoxes = useCallback(() => {
    const boxes = getActiveBoxes(state);
    const selected = boxes.filter((b) => state.selectedBoxIds.includes(b.id));
    if (selected.length === 0) return;
    dispatch({ type: 'COPY_BOXES', boxes: selected });
  }, [state]);

  const pasteBoxes = useCallback(() => {
    if (!state.clipboard || state.clipboard.length === 0) return;
    const boxes = getActiveBoxes(state);
    const newBoxes = duplicateBoxGroup(state.clipboard, boxes);
    dispatch({ type: 'PASTE_BOXES', boxes: newBoxes });
  }, [state]);

  const deleteSelectedBoxes = useCallback(() => {
    if (state.selectedBoxIds.length === 0) return;
    dispatch({ type: 'DELETE_SELECTED_BOXES', ids: state.selectedBoxIds });
  }, [state.selectedBoxIds]);

  const startComponentBuilder = useCallback(() => {
    dispatch({ type: 'START_COMPONENT_BUILDER' });
  }, []);

  const saveComponentAction = useCallback((name: string) => {
    if (!state.currentTemplate) return;
    const template: ComponentTemplate = {
      ...state.currentTemplate,
      name,
      createdAt: Date.now(),
    };
    saveComponentToDb(template);
    dispatch({ type: 'SAVE_COMPONENT', name });
  }, [state.currentTemplate]);

  const cancelComponentBuilder = useCallback(() => {
    dispatch({ type: 'CANCEL_COMPONENT_BUILDER' });
  }, []);

  const placeComponent = useCallback((template: ComponentTemplate) => {
    dispatch({ type: 'PLACE_COMPONENT', template });
  }, []);

  const deleteComponentTemplate = useCallback((id: string) => {
    deleteComponentFromDb(id);
    dispatch({ type: 'DELETE_COMPONENT', id });
  }, []);

  const toggleSnap = useCallback(() => {
    dispatch({ type: 'TOGGLE_SNAP' });
  }, []);

  const groupSelectedBoxes = useCallback(() => {
    if (state.selectedBoxIds.length < 2) return;
    dispatch({ type: 'GROUP_BOXES', ids: state.selectedBoxIds, groupId: uuid() });
  }, [state.selectedBoxIds]);

  const ungroupSelectedBoxes = useCallback(() => {
    if (state.selectedBoxIds.length === 0) return;
    dispatch({ type: 'UNGROUP_BOXES', ids: state.selectedBoxIds });
  }, [state.selectedBoxIds]);

  const toggleLockSelectedBoxes = useCallback(() => {
    if (state.selectedBoxIds.length === 0) return;
    dispatch({ type: 'TOGGLE_LOCK', ids: state.selectedBoxIds });
  }, [state.selectedBoxIds]);

  return (
    <ProjectContext.Provider
      value={{
        state,
        addBox,
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
        saveComponent: saveComponentAction,
        cancelComponentBuilder,
        placeComponent,
        deleteComponentTemplate,
        toggleSnap,
        groupSelectedBoxes,
        ungroupSelectedBoxes,
        toggleLockSelectedBoxes,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjectStore() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProjectStore must be used within a ProjectProvider');
  }
  return context;
}
