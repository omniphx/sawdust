import { useProjectStore } from '../store/projectStore';

export function useSelection() {
  const { state, selectBox, getSelectedBox, updateBox, deleteBox } = useProjectStore();

  return {
    selectedBoxId: state.selectedBoxId,
    selectedBox: getSelectedBox(),
    selectBox,
    updateBox,
    deleteBox,
    deselectAll: () => selectBox(null),
  };
}
