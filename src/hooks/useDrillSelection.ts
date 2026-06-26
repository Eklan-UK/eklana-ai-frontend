import { useCallback, useEffect, useMemo, useState } from "react";

export function useDrillSelection(
  visibleDrillIds: string[],
  resetKey?: string
) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const selectionResetKey = `${resetKey ?? ""}|${visibleDrillIds.join(",")}`;

  useEffect(() => {
    setSelectedIds(new Set());
  }, [selectionResetKey]);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      const allSelected =
        visibleDrillIds.length > 0 &&
        visibleDrillIds.every((id) => prev.has(id));
      if (allSelected) {
        return new Set();
      }
      return new Set(visibleDrillIds);
    });
  }, [visibleDrillIds]);

  const clear = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectedCount = selectedIds.size;
  const visibleDrillCount = visibleDrillIds.length;
  const allSelected =
    visibleDrillCount > 0 &&
    visibleDrillIds.every((id) => selectedIds.has(id));
  const someSelected = selectedCount > 0;
  const canBulkDelete =
    selectedCount > 0 && selectedCount < visibleDrillCount;

  const selectedIdList = useMemo(
    () => visibleDrillIds.filter((id) => selectedIds.has(id)),
    [visibleDrillIds, selectedIds]
  );

  return {
    selectedIds,
    selectedIdList,
    selectedCount,
    visibleDrillCount,
    allSelected,
    someSelected,
    canBulkDelete,
    isSelected: (id: string) => selectedIds.has(id),
    toggle,
    toggleAll,
    clear,
  };
}
