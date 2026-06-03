/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from 'zustand';
import { Project, Asset, Section, Item, LayoutVariant, LayoutElement } from '../schemas/project';
import { solveLayout } from '../layout/solver';

const MAX_HISTORY = 50;

export interface EditorState {
  project: Project;
  assets: Asset[];
  selectedElementId: string | null;
  zoom: number;
  undoStack: Project[];
  redoStack: Project[];
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  lastSavedProjectJson: string | null;
  layoutVariants: LayoutVariant[];
  activeVariantId: string | null;
  comparisonVariantId: string | null;
  primaryLayout: Project['layout'];
  primaryPolishedBackground: Project['polishedBackground'];

  setProject: (project: Project, assets: Asset[]) => void;
  updateProjectField: (path: string, value: any) => void;
  updateSection: (sectionId: string, updates: Partial<Section>) => void;
  updateItem: (itemId: string, updates: Partial<Item>) => void;
  reorderSections: (sectionIds: string[]) => void;
  reorderItems: (sectionId: string, itemIds: string[]) => void;
  setZoom: (zoom: number) => void;
  selectElement: (elementId: string | null) => void;
  updateLayoutElements: (
    updates: Array<{ id: string; x?: number; y?: number; width?: number; height?: number; locked?: boolean }>
  ) => void;
  undo: () => void;
  redo: () => void;
  saveProject: () => Promise<void>;
  addAsset: (asset: Asset) => void;
  addAssets: (assets: Asset[]) => void;
  createVariant: (name: string, layoutFamily: string, density: 'loose' | 'normal' | 'dense') => void;
  deleteVariant: (variantId: string) => void;
  duplicateVariant: (variantId: string | null) => void;
  selectActiveVariant: (variantId: string | null) => void;
  selectComparisonVariant: (variantId: string | null) => void;
  applyVariantAsPrimary: (variantId: string) => void;
}

let lastHistoryPushTime = 0;
let lastHistoryPath = '';
const HISTORY_DEBOUNCE_MS = 1000;

const cloneProject = <T>(p: T): T => {
  return structuredClone(p);
};

const setNestedField = (obj: any, path: string, value: any) => {
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current)) {
      current[part] = {};
    }
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
};

const generateUUID = (): string => {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const initialDefaultProject: Project = {
  id: '',
  name: 'New Project',
  schemaVersion: '1.0.0',
  type: 'inventory_board',
  canvas: {
    id: 'letter',
    name: 'Letter',
    widthPx: 2550,
    heightPx: 3300,
    dpi: 300,
    safeMarginPx: 120,
    unit: 'in',
  },
  brand: {
    id: '',
    brandName: '',
    logoAssetId: null,
    website: '',
    phone: '',
    email: '',
    defaultFooter: '',
    defaultDisclaimer: '',
    colors: {
      background: '#FFFFFF',
      primary: '#000000',
      secondary: '#666666',
      muted: '#CCCCCC',
    },
    styleKeywords: [],
    fontPreferences: {
      heading: 'Inter',
      body: 'Inter',
      price: 'Inter',
    },
  },
  content: {
    headline: '',
    subheadline: '',
    sections: [],
  },
  layout: {
    elements: [],
    layoutFamily: 'inventory_board',
    density: 'normal',
    score: 100,
    warnings: [],
  },
  exportSettings: {
    exactTextOverlay: true,
    aiPolishMode: 'background_and_style',
    finalFormats: ['png', 'pdf'],
  },
  polishedBackground: {
    assetId: null,
    fitMode: 'cover',
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    opacity: 1,
    legibilityPreset: 'none',
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  layoutVariants: [],
  activeVariantId: null,
};

const resolveAndUpdateState = (
  nextProject: Project,
  get: () => EditorState,
  isContentChange: boolean
) => {
  const state = get();
  const activeVariantId = state.activeVariantId;
  let primaryLayout = { ...state.primaryLayout };
  let primaryPolishedBackground = { ...state.primaryPolishedBackground };
  let layoutVariants = [...state.layoutVariants];

  if (isContentChange) {
    // Content changed, re-solve primary layout + all variants
    const solvedPrimary = solveLayout(nextProject, {
      id: 'primary-mock',
      name: 'Primary Layout Mock',
      layoutFamily: primaryLayout.layoutFamily,
      density: primaryLayout.density,
      elements: primaryLayout.elements,
      score: primaryLayout.score,
      warnings: primaryLayout.warnings,
      polishedBackground: primaryPolishedBackground,
    });
    primaryLayout = {
      ...primaryLayout,
      elements: solvedPrimary.elements,
      score: solvedPrimary.score,
      warnings: solvedPrimary.warnings,
    };

    layoutVariants = layoutVariants.map((v) => {
      const solvedVariant = solveLayout(nextProject, v);
      return {
        ...v,
        elements: solvedVariant.elements,
        score: solvedVariant.score,
        warnings: solvedVariant.warnings,
      };
    });
  } else {
    // Only active layout edited
    if (!activeVariantId) {
      const solved = solveLayout(nextProject);
      primaryLayout = {
        ...nextProject.layout,
        elements: solved.elements,
        score: solved.score,
        warnings: solved.warnings,
      };
      primaryPolishedBackground = nextProject.polishedBackground;
    } else {
      const solved = solveLayout(nextProject);
      layoutVariants = layoutVariants.map((v) => {
        if (v.id === activeVariantId) {
          return {
            ...v,
            layoutFamily: nextProject.layout.layoutFamily,
            density: nextProject.layout.density,
            elements: solved.elements,
            score: solved.score,
            warnings: solved.warnings,
            polishedBackground: nextProject.polishedBackground ? cloneProject(nextProject.polishedBackground) : undefined,
          };
        }
        return v;
      });
    }
  }

  if (activeVariantId) {
    const activeVariant = layoutVariants.find((v) => v.id === activeVariantId);
    if (activeVariant) {
      nextProject.layout = {
        ...nextProject.layout,
        layoutFamily: activeVariant.layoutFamily,
        density: activeVariant.density,
        elements: cloneProject(activeVariant.elements as any),
        score: activeVariant.score,
        warnings: activeVariant.warnings,
      };
      if (activeVariant.polishedBackground) {
        nextProject.polishedBackground = cloneProject(activeVariant.polishedBackground);
      }
    }
  } else {
    nextProject.layout = cloneProject(primaryLayout);
    nextProject.polishedBackground = cloneProject(primaryPolishedBackground);
  }

  nextProject.layoutVariants = layoutVariants;
  nextProject.activeVariantId = activeVariantId;

  return {
    project: nextProject,
    layoutVariants,
    primaryLayout,
    primaryPolishedBackground,
  };
};

export const useEditorStore = create<EditorState>((set, get) => ({
  project: initialDefaultProject,
  assets: [],
  selectedElementId: null,
  zoom: 0.75,
  undoStack: [],
  redoStack: [],
  isSaving: false,
  hasUnsavedChanges: false,
  lastSavedProjectJson: null,
  layoutVariants: [],
  activeVariantId: null,
  comparisonVariantId: null,
  primaryLayout: initialDefaultProject.layout,
  primaryPolishedBackground: initialDefaultProject.polishedBackground,

  setProject: (project, assets) => {
    const canonicalProject = cloneProject(project);
    const solved = solveLayout(canonicalProject);
    canonicalProject.layout.elements = solved.elements;
    canonicalProject.layout.score = solved.score;
    canonicalProject.layout.warnings = solved.warnings;

    const layoutVariants = canonicalProject.layoutVariants || [];
    const activeVariantId = canonicalProject.activeVariantId || null;

    const primaryLayout = cloneProject(canonicalProject.layout);
    const primaryPolishedBackground = cloneProject(canonicalProject.polishedBackground);

    const activeProject = cloneProject(canonicalProject);
    if (activeVariantId) {
      const activeVariant = layoutVariants.find((v) => v.id === activeVariantId);
      if (activeVariant) {
        activeProject.layout = {
          ...activeProject.layout,
          layoutFamily: activeVariant.layoutFamily,
          density: activeVariant.density,
          elements: cloneProject(activeVariant.elements as LayoutElement[]),
          score: activeVariant.score,
          warnings: activeVariant.warnings,
        };
        if (activeVariant.polishedBackground) {
          activeProject.polishedBackground = cloneProject(activeVariant.polishedBackground);
        }
      }
    }

    lastHistoryPath = '';
    lastHistoryPushTime = 0;

    set({
      project: activeProject,
      assets: assets || [],
      selectedElementId: null,
      zoom: 0.75,
      undoStack: [],
      redoStack: [],
      isSaving: false,
      hasUnsavedChanges: false,
      lastSavedProjectJson: JSON.stringify(canonicalProject),
      layoutVariants,
      activeVariantId,
      comparisonVariantId: null,
      primaryLayout,
      primaryPolishedBackground,
    });
  },

  updateProjectField: (path, value) => {
    const { project, primaryLayout, primaryPolishedBackground, layoutVariants, activeVariantId, undoStack } = get();
    const canonicalCurrentProject = {
      ...cloneProject(project),
      layout: cloneProject(primaryLayout),
      polishedBackground: cloneProject(primaryPolishedBackground),
      layoutVariants: cloneProject(layoutVariants),
      activeVariantId,
    };

    const nextProject = cloneProject(project);
    setNestedField(nextProject, path, value);

    const isContentChange = !path.startsWith('layout') && !path.startsWith('polishedBackground');
    const updated = resolveAndUpdateState(nextProject, get, isContentChange);
    
    const now = Date.now();
    const shouldPush = path !== lastHistoryPath || (now - lastHistoryPushTime) > HISTORY_DEBOUNCE_MS;

    if (shouldPush) {
      lastHistoryPushTime = now;
      lastHistoryPath = path;
      set({
        ...updated,
        undoStack: [...undoStack, canonicalCurrentProject].slice(-MAX_HISTORY),
        redoStack: [],
        hasUnsavedChanges: true,
      });
    } else {
      set({
        ...updated,
        hasUnsavedChanges: true,
      });
    }
  },

  updateSection: (sectionId, updates) => {
    const { project, primaryLayout, primaryPolishedBackground, layoutVariants, activeVariantId, undoStack } = get();
    const canonicalCurrentProject = {
      ...cloneProject(project),
      layout: cloneProject(primaryLayout),
      polishedBackground: cloneProject(primaryPolishedBackground),
      layoutVariants: cloneProject(layoutVariants),
      activeVariantId,
    };

    const nextProject = cloneProject(project);
    const section = nextProject.content.sections.find((s) => s.id === sectionId);
    if (section) {
      Object.assign(section, updates);
      const updated = resolveAndUpdateState(nextProject, get, true);

      const now = Date.now();
      const path = `section.${sectionId}`;
      const shouldPush = path !== lastHistoryPath || (now - lastHistoryPushTime) > HISTORY_DEBOUNCE_MS;

      if (shouldPush) {
        lastHistoryPushTime = now;
        lastHistoryPath = path;
        set({
          ...updated,
          undoStack: [...undoStack, canonicalCurrentProject].slice(-MAX_HISTORY),
          redoStack: [],
          hasUnsavedChanges: true,
        });
      } else {
        set({
          ...updated,
          hasUnsavedChanges: true,
        });
      }
    }
  },

  updateItem: (itemId, updates) => {
    const { project, primaryLayout, primaryPolishedBackground, layoutVariants, activeVariantId, undoStack } = get();
    const canonicalCurrentProject = {
      ...cloneProject(project),
      layout: cloneProject(primaryLayout),
      polishedBackground: cloneProject(primaryPolishedBackground),
      layoutVariants: cloneProject(layoutVariants),
      activeVariantId,
    };

    const nextProject = cloneProject(project);
    let itemFound = false;
    for (const section of nextProject.content.sections) {
      const itemIdx = section.items.findIndex((it) => it.id === itemId);
      if (itemIdx !== -1) {
        section.items[itemIdx] = {
          ...section.items[itemIdx],
          ...updates,
        };
        itemFound = true;
        break;
      }
    }

    if (itemFound) {
      const updated = resolveAndUpdateState(nextProject, get, true);

      const now = Date.now();
      const path = `item.${itemId}`;
      const shouldPush = path !== lastHistoryPath || (now - lastHistoryPushTime) > HISTORY_DEBOUNCE_MS;

      if (shouldPush) {
        lastHistoryPushTime = now;
        lastHistoryPath = path;
        set({
          ...updated,
          undoStack: [...undoStack, canonicalCurrentProject].slice(-MAX_HISTORY),
          redoStack: [],
          hasUnsavedChanges: true,
        });
      } else {
        set({
          ...updated,
          hasUnsavedChanges: true,
        });
      }
    }
  },

  reorderSections: (sectionIds) => {
    const { project, primaryLayout, primaryPolishedBackground, layoutVariants, activeVariantId, undoStack } = get();
    const canonicalCurrentProject = {
      ...cloneProject(project),
      layout: cloneProject(primaryLayout),
      polishedBackground: cloneProject(primaryPolishedBackground),
      layoutVariants: cloneProject(layoutVariants),
      activeVariantId,
    };

    const nextProject = cloneProject(project);
    const sections = [...nextProject.content.sections];
    const orderedSections = sectionIds
      .map((id) => sections.find((s) => s.id === id))
      .filter((s): s is Section => !!s);

    sections.forEach((s) => {
      if (!orderedSections.find((os) => os.id === s.id)) {
        orderedSections.push(s);
      }
    });

    orderedSections.forEach((s, idx) => {
      s.order = idx;
    });

    nextProject.content.sections = orderedSections;

    const updated = resolveAndUpdateState(nextProject, get, true);
    set({
      ...updated,
      undoStack: [...undoStack, canonicalCurrentProject].slice(-MAX_HISTORY),
      redoStack: [],
      hasUnsavedChanges: true,
    });
  },

  reorderItems: (sectionId, itemIds) => {
    const { project, primaryLayout, primaryPolishedBackground, layoutVariants, activeVariantId, undoStack } = get();
    const canonicalCurrentProject = {
      ...cloneProject(project),
      layout: cloneProject(primaryLayout),
      polishedBackground: cloneProject(primaryPolishedBackground),
      layoutVariants: cloneProject(layoutVariants),
      activeVariantId,
    };

    const nextProject = cloneProject(project);
    const section = nextProject.content.sections.find((s) => s.id === sectionId);
    if (section) {
      const items = [...section.items];
      const orderedItems = itemIds
        .map((id) => items.find((it) => it.id === id))
        .filter((it): it is Item => !!it);

      items.forEach((it) => {
        if (!orderedItems.find((oi) => oi.id === it.id)) {
          orderedItems.push(it);
        }
      });

      section.items = orderedItems;

      const updated = resolveAndUpdateState(nextProject, get, true);
      set({
        ...updated,
        undoStack: [...undoStack, canonicalCurrentProject].slice(-MAX_HISTORY),
        redoStack: [],
        hasUnsavedChanges: true,
      });
    }
  },

  setZoom: (zoom) => {
    set({ zoom });
  },

  selectElement: (elementId) => {
    set({ selectedElementId: elementId });
  },

  updateLayoutElements: (updates) => {
    const { project, primaryLayout, primaryPolishedBackground, layoutVariants, activeVariantId, undoStack } = get();
    const canonicalCurrentProject = {
      ...cloneProject(project),
      layout: cloneProject(primaryLayout),
      polishedBackground: cloneProject(primaryPolishedBackground),
      layoutVariants: cloneProject(layoutVariants),
      activeVariantId,
    };

    const nextProject = cloneProject(project);
    let hasChanges = false;
    for (const update of updates) {
      const element = nextProject.layout.elements.find((el) => el.id === update.id);
      if (element) {
        const xChanged = update.x !== undefined && update.x !== element.x;
        const yChanged = update.y !== undefined && update.y !== element.y;
        const widthChanged = update.width !== undefined && update.width !== element.width;
        const heightChanged = update.height !== undefined && update.height !== element.height;

        if (update.x !== undefined) element.x = update.x;
        if (update.y !== undefined) element.y = update.y;
        if (update.width !== undefined) element.width = update.width;
        if (update.height !== undefined) element.height = update.height;

        if (xChanged || yChanged || widthChanged || heightChanged) {
          element.locked = true;
        } else if (update.locked !== undefined) {
          element.locked = update.locked;
        }
        hasChanges = true;
      }
    }

    if (hasChanges) {
      const updated = resolveAndUpdateState(nextProject, get, false);
      set({
        ...updated,
        undoStack: [...undoStack, canonicalCurrentProject].slice(-MAX_HISTORY),
        redoStack: [],
        hasUnsavedChanges: true,
      });
    }
  },

  createVariant: (name, layoutFamily, density) => {
    const { project, primaryLayout, primaryPolishedBackground, layoutVariants, activeVariantId, undoStack } = get();
    if (layoutVariants.length >= 5) return;

    const canonicalCurrentProject = {
      ...cloneProject(project),
      layout: cloneProject(primaryLayout),
      polishedBackground: cloneProject(primaryPolishedBackground),
      layoutVariants: cloneProject(layoutVariants),
      activeVariantId,
    };

    const newId = generateUUID();
    const solved = solveLayout(project, {
      id: newId,
      name,
      layoutFamily,
      density,
      elements: [],
      score: 100,
      warnings: [],
      polishedBackground: project.polishedBackground ? cloneProject(project.polishedBackground) : undefined,
    });
    const newVariant: LayoutVariant = {
      id: newId,
      name,
      layoutFamily,
      density,
      elements: solved.elements,
      score: solved.score,
      warnings: solved.warnings,
      polishedBackground: project.polishedBackground ? cloneProject(project.polishedBackground) : undefined,
    };

    const nextLayoutVariants = [...layoutVariants, newVariant];
    const nextProject = cloneProject(project);
    nextProject.layoutVariants = nextLayoutVariants;
    nextProject.activeVariantId = activeVariantId;

    if (activeVariantId) {
      const activeVariant = nextLayoutVariants.find((v) => v.id === activeVariantId);
      if (activeVariant) {
        nextProject.layout = {
          ...nextProject.layout,
          layoutFamily: activeVariant.layoutFamily,
          density: activeVariant.density,
          elements: cloneProject(activeVariant.elements as any),
          score: activeVariant.score,
          warnings: activeVariant.warnings,
        };
        if (activeVariant.polishedBackground) {
          nextProject.polishedBackground = cloneProject(activeVariant.polishedBackground);
        }
      }
    } else {
      nextProject.layout = cloneProject(primaryLayout);
      nextProject.polishedBackground = cloneProject(primaryPolishedBackground);
    }
    set({
      project: nextProject,
      layoutVariants: nextLayoutVariants,
      undoStack: [...undoStack, canonicalCurrentProject].slice(-MAX_HISTORY),
      redoStack: [],
      hasUnsavedChanges: true,
    });
  },

  deleteVariant: (variantId) => {
    const { project, primaryLayout, primaryPolishedBackground, layoutVariants, activeVariantId, comparisonVariantId, undoStack } = get();
    if (!layoutVariants.some((v) => v.id === variantId)) return;

    const canonicalCurrentProject = {
      ...cloneProject(project),
      layout: cloneProject(primaryLayout),
      polishedBackground: cloneProject(primaryPolishedBackground),
      layoutVariants: cloneProject(layoutVariants),
      activeVariantId,
    };

    const nextLayoutVariants = layoutVariants.filter((v) => v.id !== variantId);
    let nextActiveId = activeVariantId;
    let nextComparisonId = comparisonVariantId;

    if (activeVariantId === variantId) {
      nextActiveId = null;
    }
    if (comparisonVariantId === variantId) {
      nextComparisonId = null;
    }

    const nextProject = cloneProject(project);
    nextProject.layoutVariants = nextLayoutVariants;
    nextProject.activeVariantId = nextActiveId;

    if (nextActiveId) {
      const activeVariant = nextLayoutVariants.find((v) => v.id === nextActiveId);
      if (activeVariant) {
        nextProject.layout = {
          ...nextProject.layout,
          layoutFamily: activeVariant.layoutFamily,
          density: activeVariant.density,
          elements: cloneProject(activeVariant.elements as any),
          score: activeVariant.score,
          warnings: activeVariant.warnings,
        };
        if (activeVariant.polishedBackground) {
          nextProject.polishedBackground = cloneProject(activeVariant.polishedBackground);
        }
      }
    } else {
      nextProject.layout = cloneProject(primaryLayout);
      nextProject.polishedBackground = cloneProject(primaryPolishedBackground);
    }
    set({
      project: nextProject,
      layoutVariants: nextLayoutVariants,
      activeVariantId: nextActiveId,
      comparisonVariantId: nextComparisonId,
      undoStack: [...undoStack, canonicalCurrentProject].slice(-MAX_HISTORY),
      redoStack: [],
      hasUnsavedChanges: true,
    });
  },

  duplicateVariant: (variantId: string | null) => {
    const { project, primaryLayout, primaryPolishedBackground, layoutVariants, activeVariantId, undoStack } = get();
    if (layoutVariants.length >= 5) return;
    const baseVariant = variantId ? layoutVariants.find((v) => v.id === variantId) : undefined;

    const canonicalCurrentProject = {
      ...cloneProject(project),
      layout: cloneProject(primaryLayout),
      polishedBackground: cloneProject(primaryPolishedBackground),
      layoutVariants: cloneProject(layoutVariants),
      activeVariantId,
    };

    const newId = generateUUID();
    let newVariant: LayoutVariant;

    if (!baseVariant) {
      newVariant = {
        id: newId,
        name: 'Primary Layout (Copy)',
        layoutFamily: primaryLayout.layoutFamily,
        density: primaryLayout.density,
        elements: cloneProject(primaryLayout.elements as any),
        score: primaryLayout.score,
        warnings: [...primaryLayout.warnings],
        polishedBackground: primaryPolishedBackground ? cloneProject(primaryPolishedBackground) : undefined,
      };
    } else {
      newVariant = {
        id: newId,
        name: `${baseVariant.name} (Copy)`,
        layoutFamily: baseVariant.layoutFamily,
        density: baseVariant.density,
        elements: cloneProject(baseVariant.elements as any),
        score: baseVariant.score,
        warnings: [...baseVariant.warnings],
        polishedBackground: baseVariant.polishedBackground ? cloneProject(baseVariant.polishedBackground) : undefined,
      };
    }

    const nextLayoutVariants = [...layoutVariants, newVariant];
    const nextProject = cloneProject(project);
    nextProject.layoutVariants = nextLayoutVariants;
    nextProject.activeVariantId = activeVariantId;

    if (activeVariantId) {
      const activeVariant = nextLayoutVariants.find((v) => v.id === activeVariantId);
      if (activeVariant) {
        nextProject.layout = {
          ...nextProject.layout,
          layoutFamily: activeVariant.layoutFamily,
          density: activeVariant.density,
          elements: cloneProject(activeVariant.elements as any),
          score: activeVariant.score,
          warnings: activeVariant.warnings,
        };
        if (activeVariant.polishedBackground) {
          nextProject.polishedBackground = cloneProject(activeVariant.polishedBackground);
        }
      }
    } else {
      nextProject.layout = cloneProject(primaryLayout);
      nextProject.polishedBackground = cloneProject(primaryPolishedBackground);
    }
    set({
      project: nextProject,
      layoutVariants: nextLayoutVariants,
      undoStack: [...undoStack, canonicalCurrentProject].slice(-MAX_HISTORY),
      redoStack: [],
      hasUnsavedChanges: true,
    });
  },

  selectActiveVariant: (variantId) => {
    const { project, primaryLayout, primaryPolishedBackground, layoutVariants, activeVariantId, undoStack } = get();
    if (activeVariantId === variantId) return;

    const canonicalCurrentProject = {
      ...cloneProject(project),
      layout: cloneProject(primaryLayout),
      polishedBackground: cloneProject(primaryPolishedBackground),
      layoutVariants: cloneProject(layoutVariants),
      activeVariantId,
    };

    const nextProject = cloneProject(project);
    nextProject.activeVariantId = variantId;

    if (variantId) {
      const activeVariant = layoutVariants.find((v) => v.id === variantId);
      if (activeVariant) {
        nextProject.layout = {
          ...nextProject.layout,
          layoutFamily: activeVariant.layoutFamily,
          density: activeVariant.density,
          elements: cloneProject(activeVariant.elements as any),
          score: activeVariant.score,
          warnings: activeVariant.warnings,
        };
        if (activeVariant.polishedBackground) {
          nextProject.polishedBackground = cloneProject(activeVariant.polishedBackground);
        }
      }
    } else {
      nextProject.layout = cloneProject(primaryLayout);
      nextProject.polishedBackground = cloneProject(primaryPolishedBackground);
    }
    set({
      project: nextProject,
      activeVariantId: variantId,
      undoStack: [...undoStack, canonicalCurrentProject].slice(-MAX_HISTORY),
      redoStack: [],
      hasUnsavedChanges: true,
    });
  },

  selectComparisonVariant: (variantId) => {
    set({
      comparisonVariantId: variantId,
    });
  },

  applyVariantAsPrimary: (variantId) => {
    const { project, primaryLayout, primaryPolishedBackground, layoutVariants, activeVariantId, undoStack } = get();
    const variant = layoutVariants.find((v) => v.id === variantId);
    if (!variant) return;

    const canonicalCurrentProject = {
      ...cloneProject(project),
      layout: cloneProject(primaryLayout),
      polishedBackground: cloneProject(primaryPolishedBackground),
      layoutVariants: cloneProject(layoutVariants),
      activeVariantId,
    };

    const newPrimaryLayout = {
      ...primaryLayout,
      layoutFamily: variant.layoutFamily,
      density: variant.density,
      elements: cloneProject(variant.elements as any),
      score: variant.score,
      warnings: [...variant.warnings],
    };

    const newPrimaryPolishedBackground = variant.polishedBackground
      ? cloneProject(variant.polishedBackground)
      : cloneProject(primaryPolishedBackground);

    const nextProject = cloneProject(project);
    nextProject.activeVariantId = null;
    nextProject.layout = cloneProject(newPrimaryLayout);
    nextProject.polishedBackground = cloneProject(newPrimaryPolishedBackground);
    set({
      project: nextProject,
      activeVariantId: null,
      primaryLayout: newPrimaryLayout,
      primaryPolishedBackground: newPrimaryPolishedBackground,
      undoStack: [...undoStack, canonicalCurrentProject].slice(-MAX_HISTORY),
      redoStack: [],
      hasUnsavedChanges: true,
    });
  },

  undo: () => {
    set((state) => {
      if (state.undoStack.length === 0) return {};
      const nextUndoStack = [...state.undoStack];
      const poppedProject = nextUndoStack.pop()!;

      const layoutVariants = poppedProject.layoutVariants || [];
      const activeVariantId = poppedProject.activeVariantId || null;
      const primaryLayout = cloneProject(poppedProject.layout);
      const primaryPolishedBackground = cloneProject(poppedProject.polishedBackground);

      const activeProject = cloneProject(poppedProject);
      if (activeVariantId) {
        const activeVariant = layoutVariants.find((v) => v.id === activeVariantId);
        if (activeVariant) {
          activeProject.layout = {
            ...activeProject.layout,
            layoutFamily: activeVariant.layoutFamily,
            density: activeVariant.density,
            elements: cloneProject(activeVariant.elements as any),
            score: activeVariant.score,
            warnings: activeVariant.warnings,
          };
          if (activeVariant.polishedBackground) {
            activeProject.polishedBackground = cloneProject(activeVariant.polishedBackground);
          }
        }
      }

      const canonicalCurrentProject = {
        ...cloneProject(state.project),
        layout: cloneProject(state.primaryLayout),
        polishedBackground: cloneProject(state.primaryPolishedBackground),
        layoutVariants: cloneProject(state.layoutVariants),
        activeVariantId: state.activeVariantId,
      };

      lastHistoryPath = '';
      lastHistoryPushTime = 0;

      return {
        project: activeProject,
        layoutVariants,
        activeVariantId,
        primaryLayout,
        primaryPolishedBackground,
        undoStack: nextUndoStack,
        redoStack: [...state.redoStack, canonicalCurrentProject].slice(-MAX_HISTORY),
        hasUnsavedChanges: true,
      };
    });
  },

  redo: () => {
    set((state) => {
      if (state.redoStack.length === 0) return {};
      const nextRedoStack = [...state.redoStack];
      const poppedProject = nextRedoStack.pop()!;

      const layoutVariants = poppedProject.layoutVariants || [];
      const activeVariantId = poppedProject.activeVariantId || null;
      const primaryLayout = cloneProject(poppedProject.layout);
      const primaryPolishedBackground = cloneProject(poppedProject.polishedBackground);

      const activeProject = cloneProject(poppedProject);
      if (activeVariantId) {
        const activeVariant = layoutVariants.find((v) => v.id === activeVariantId);
        if (activeVariant) {
          activeProject.layout = {
            ...activeProject.layout,
            layoutFamily: activeVariant.layoutFamily,
            density: activeVariant.density,
            elements: cloneProject(activeVariant.elements as any),
            score: activeVariant.score,
            warnings: activeVariant.warnings,
          };
          if (activeVariant.polishedBackground) {
            activeProject.polishedBackground = cloneProject(activeVariant.polishedBackground);
          }
        }
      }

      const canonicalCurrentProject = {
        ...cloneProject(state.project),
        layout: cloneProject(state.primaryLayout),
        polishedBackground: cloneProject(state.primaryPolishedBackground),
        layoutVariants: cloneProject(state.layoutVariants),
        activeVariantId: state.activeVariantId,
      };

      lastHistoryPath = '';
      lastHistoryPushTime = 0;

      return {
        project: activeProject,
        layoutVariants,
        activeVariantId,
        primaryLayout,
        primaryPolishedBackground,
        undoStack: [...state.undoStack, canonicalCurrentProject].slice(-MAX_HISTORY),
        redoStack: nextRedoStack,
        hasUnsavedChanges: true,
      };
    });
  },

  saveProject: async () => {
    const { project, primaryLayout, primaryPolishedBackground, layoutVariants, activeVariantId } = get();
    const canonicalProject = {
      ...cloneProject(project),
      layout: cloneProject(primaryLayout),
      polishedBackground: cloneProject(primaryPolishedBackground),
      layoutVariants: cloneProject(layoutVariants),
      activeVariantId,
    };
    const projectJsonBeforeSave = JSON.stringify(canonicalProject);
    set({ isSaving: true });
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: projectJsonBeforeSave,
      });

      if (!response.ok) {
        throw new Error(`Failed to save project. Status: ${response.status}`);
      }

      set({
        isSaving: false,
        hasUnsavedChanges: false,
        lastSavedProjectJson: projectJsonBeforeSave,
      });
    } catch (error) {
      console.error('Error saving project:', error);
      set({ isSaving: false });
      throw error;
    }
  },

  addAsset: (asset) => {
    set((state) => ({
      assets: [...state.assets.filter((a) => a.id !== asset.id), asset],
    }));
  },

  addAssets: (newAssets) => {
    set((state) => {
      const filtered = state.assets.filter(
        (a) => !newAssets.some((na) => na.id === a.id)
      );
      return {
        assets: [...filtered, ...newAssets],
      };
    });
  },
}));
