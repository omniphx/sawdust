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
  selectedBoxId: string | null;
  isLoading: boolean;
  mode: 'project' | 'component-builder';
  currentTemplate: ComponentTemplate | null;
  componentLibrary: ComponentTemplate[];
  clipboard: Box | null;
}

type ProjectAction =
  | { type: 'SET_PROJECT'; project: Project }
  | { type: 'SET_LOADING'; isLoading: boolean }
  | { type: 'ADD_BOX'; box: Box }
  | { type: 'UPDATE_BOX'; id: string; updates: Partial<Box> }
  | { type: 'DELETE_BOX'; id: string }
  | { type: 'SELECT_BOX'; id: string | null }
  | { type: 'SET_UNIT_SYSTEM'; unitSystem: UnitSystem }
  | { type: 'SET_PROJECT_NAME'; name: string }
  | { type: 'START_COMPONENT_BUILDER' }
  | { type: 'SAVE_COMPONENT'; name: string }
  | { type: 'CANCEL_COMPONENT_BUILDER' }
  | { type: 'PLACE_COMPONENT'; template: ComponentTemplate }
  | { type: 'LOAD_COMPONENTS'; components: ComponentTemplate[] }
  | { type: 'DELETE_COMPONENT'; id: string }
  | { type: 'COPY_BOX'; box: Box }
  | { type: 'PASTE_BOX'; box: Box }
  | { type: 'DUPLICATE_BOX'; box: Box };

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
        selectedBoxId: state.selectedBoxId === action.id ? null : state.selectedBoxId,
      };
    }

    case 'SELECT_BOX':
      return { ...state, selectedBoxId: action.id };

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
        selectedBoxId: null,
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
        selectedBoxId: null,
        componentLibrary: [saved, ...state.componentLibrary],
      };
    }

    case 'CANCEL_COMPONENT_BUILDER':
      return {
        ...state,
        mode: 'project',
        currentTemplate: null,
        selectedBoxId: null,
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

    case 'COPY_BOX':
      return { ...state, clipboard: action.box };

    case 'PASTE_BOX':
    case 'DUPLICATE_BOX': {
      const boxes = [...getActiveBoxes(state), action.box];
      const newState = setActiveBoxes(state, boxes);
      return { ...newState, selectedBoxId: action.box.id };
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
  selectBox: (id: string | null) => void;
  setUnitSystem: (unitSystem: UnitSystem) => void;
  setProjectName: (name: string) => void;
  getSelectedBox: () => Box | undefined;
  duplicateBox: (id: string) => void;
  copyBox: (id: string) => void;
  pasteBox: () => void;
  startComponentBuilder: () => void;
  saveComponent: (name: string) => void;
  cancelComponentBuilder: () => void;
  placeComponent: (template: ComponentTemplate) => void;
  deleteComponentTemplate: (id: string) => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(projectReducer, {
    project: createDefaultProject(),
    selectedBoxId: null,
    isLoading: true,
    mode: 'project',
    currentTemplate: null,
    componentLibrary: [],
    clipboard: null,
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
    dispatch({ type: 'SELECT_BOX', id: box.id });
  }, [state]);

  const updateBox = useCallback((id: string, updates: Partial<Box>) => {
    dispatch({ type: 'UPDATE_BOX', id, updates });
  }, []);

  const deleteBox = useCallback((id: string) => {
    dispatch({ type: 'DELETE_BOX', id });
  }, []);

  const selectBox = useCallback((id: string | null) => {
    dispatch({ type: 'SELECT_BOX', id });
  }, []);

  const setUnitSystem = useCallback((unitSystem: UnitSystem) => {
    dispatch({ type: 'SET_UNIT_SYSTEM', unitSystem });
  }, []);

  const setProjectName = useCallback((name: string) => {
    dispatch({ type: 'SET_PROJECT_NAME', name });
  }, []);

  const getSelectedBox = useCallback(() => {
    const boxes = getActiveBoxes(state);
    return boxes.find((box) => box.id === state.selectedBoxId);
  }, [state]);

  const findNonOverlappingPosition = useCallback((sourceBox: Box, boxes: Box[]) => {
    const spacing = 0.25;
    let posX = sourceBox.position.x + sourceBox.dimensions.width + spacing;
    const posZ = sourceBox.position.z;
    const dim = sourceBox.dimensions;

    const isOverlapping = (x: number, z: number) => {
      for (const b of boxes) {
        if (
          x < b.position.x + b.dimensions.width + spacing &&
          b.position.x < x + dim.width + spacing &&
          z < b.position.z + b.dimensions.depth + spacing &&
          b.position.z < z + dim.depth + spacing
        ) {
          return true;
        }
      }
      return false;
    };

    while (isOverlapping(posX, posZ)) {
      posX += dim.width + spacing;
    }

    return { x: posX, y: sourceBox.position.y, z: posZ };
  }, []);

  const duplicateBox = useCallback((id: string) => {
    const boxes = getActiveBoxes(state);
    const source = boxes.find((b) => b.id === id);
    if (!source) return;

    const newBox: Box = {
      ...source,
      id: uuid(),
      position: findNonOverlappingPosition(source, boxes),
      label: source.label ? `${source.label} (copy)` : undefined,
    };
    dispatch({ type: 'DUPLICATE_BOX', box: newBox });
  }, [state, findNonOverlappingPosition]);

  const copyBox = useCallback((id: string) => {
    const boxes = getActiveBoxes(state);
    const source = boxes.find((b) => b.id === id);
    if (!source) return;
    dispatch({ type: 'COPY_BOX', box: source });
  }, [state]);

  const pasteBox = useCallback(() => {
    if (!state.clipboard) return;
    const boxes = getActiveBoxes(state);
    const newBox: Box = {
      ...state.clipboard,
      id: uuid(),
      position: findNonOverlappingPosition(state.clipboard, boxes),
      label: state.clipboard.label ? `${state.clipboard.label} (copy)` : undefined,
    };
    dispatch({ type: 'PASTE_BOX', box: newBox });
  }, [state, findNonOverlappingPosition]);

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

  return (
    <ProjectContext.Provider
      value={{
        state,
        addBox,
        updateBox,
        deleteBox,
        selectBox,
        setUnitSystem,
        setProjectName,
        getSelectedBox,
        duplicateBox,
        copyBox,
        pasteBox,
        startComponentBuilder,
        saveComponent: saveComponentAction,
        cancelComponentBuilder,
        placeComponent,
        deleteComponentTemplate,
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
