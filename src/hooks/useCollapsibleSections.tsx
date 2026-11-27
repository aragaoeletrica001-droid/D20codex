import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

const STORAGE_KEY_COLLAPSED = 'dnd2024_ui_collapsed_v1';

interface CollapsibleSectionsContextValue {
  collapsedMap: Record<string, boolean>;
  isSectionOpen: (sectionId: string, defaultOpen?: boolean) => boolean;
  toggleSection: (sectionId: string, defaultOpen?: boolean) => void;
  setSectionOpen: (sectionId: string, open: boolean) => void;
}

const CollapsibleSectionsContext = createContext<CollapsibleSectionsContextValue | null>(null);

function loadInitialCollapsedMap(): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_COLLAPSED);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, boolean>;
    }
  } catch {
    // ignore storage read errors
  }
  return {};
}

export const CollapsibleSectionsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>(loadInitialCollapsedMap);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY_COLLAPSED, JSON.stringify(collapsedMap));
    } catch {
      // ignore storage write errors
    }
  }, [collapsedMap]);

  const isSectionOpen = useCallback(
    (sectionId: string, defaultOpen = true): boolean => {
      if (sectionId in collapsedMap) {
        return !collapsedMap[sectionId];
      }
      return defaultOpen;
    },
    [collapsedMap]
  );

  const toggleSection = useCallback((sectionId: string, defaultOpen = true) => {
    setCollapsedMap((prev) => {
      const currentlyOpen = sectionId in prev ? !prev[sectionId] : defaultOpen;
      return {
        ...prev,
        [sectionId]: currentlyOpen, // true = collapsed
      };
    });
  }, []);

  const setSectionOpen = useCallback((sectionId: string, open: boolean) => {
    setCollapsedMap((prev) => ({
      ...prev,
      [sectionId]: !open,
    }));
  }, []);

  return (
    <CollapsibleSectionsContext.Provider
      value={{ collapsedMap, isSectionOpen, toggleSection, setSectionOpen }}
    >
      {children}
    </CollapsibleSectionsContext.Provider>
  );
};

export function useSectionOpen(
  sectionId: string,
  defaultOpen = true
): [boolean, () => void, (open: boolean) => void] {
  const ctx = useContext(CollapsibleSectionsContext);
  const [fallbackOpen, setFallbackOpen] = useState(defaultOpen);

  if (!ctx) {
    return [
      fallbackOpen,
      () => setFallbackOpen((v) => !v),
      (open: boolean) => setFallbackOpen(open),
    ];
  }

  return [
    ctx.isSectionOpen(sectionId, defaultOpen),
    () => ctx.toggleSection(sectionId, defaultOpen),
    (open: boolean) => ctx.setSectionOpen(sectionId, open),
  ];
}
