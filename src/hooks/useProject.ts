import { useProjectStore } from '../store/projectStore';

export function useProject() {
  const { state, setUnitSystem, setProjectName } = useProjectStore();

  return {
    project: state.project,
    isLoading: state.isLoading,
    setUnitSystem,
    setProjectName,
  };
}
