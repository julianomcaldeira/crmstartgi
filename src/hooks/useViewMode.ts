import { useState, useEffect } from "react";

export type ViewMode = "cards" | "compact";

export function useViewMode(storageKey: string, defaultMode: ViewMode = "cards"): [ViewMode, (mode: ViewMode) => void] {
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    const stored = localStorage.getItem(storageKey);
    return (stored as ViewMode) || defaultMode;
  });

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    localStorage.setItem(storageKey, mode);
  };

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored && (stored === "cards" || stored === "compact")) {
      setViewModeState(stored);
    }
  }, [storageKey]);

  return [viewMode, setViewMode];
}
