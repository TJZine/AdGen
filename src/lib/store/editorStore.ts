/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from 'zustand';
import { Project, Asset, Section, Item } from '../schemas/project';
import { solveLayout } from '../layout/solver';

export interface EditorState {
  project: Project;
  assets: Asset[];
  selectedElementId: string | null;
  zoom: number;
  undoStack: Project[];
  redoStack: Project[];
  isSaving: boolean;
  hasUnsavedChanges: boolean;

  setProject: (project: Project, assets: Asset[]) => void;
  updateProjectField: (path: string, value: any) => void;
  updateSection: (sectionId: string, updates: Partial<Section>) => void;
  updateItem: (itemId: string, updates: Partial<Item>) => void;
  reorderSections: (sectionIds: string[]) => void;
  reorderItems: (sectionId: string, itemIds: string[]) => void;
  setZoom: (zoom: number) => void;
  selectElement: (elementId: string | null) => void;
  undo: () => void;
  redo: () => void;
  saveProject: () => Promise<void>;
}

const cloneProject = (p: Project): Project => {
  return JSON.parse(JSON.stringify(p)) as Project;
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

  setProject: (project, assets) => {
    // Clones the project and runs the solver just in case the initial state needs solved elements
    const nextProject = cloneProject(project);
    const solved = solveLayout(nextProject);
    nextProject.layout.elements = solved.elements;
    nextProject.layout.score = solved.score;
    nextProject.layout.warnings = solved.warnings;

    set({
      project: nextProject,
      assets: assets || [],
      selectedElementId: null,
      undoStack: [],
      redoStack: [],
      isSaving: false,
      hasUnsavedChanges: false,
    });
  },

  updateProjectField: (path, value) => {
    const { project, undoStack } = get();
    const prevProjectCloned = cloneProject(project);
    const nextProject = cloneProject(project);

    setNestedField(nextProject, path, value);

    const solved = solveLayout(nextProject);
    nextProject.layout.elements = solved.elements;
    nextProject.layout.score = solved.score;
    nextProject.layout.warnings = solved.warnings;

    set({
      project: nextProject,
      undoStack: [...undoStack, prevProjectCloned],
      redoStack: [],
      hasUnsavedChanges: true,
    });
  },

  updateSection: (sectionId, updates) => {
    const { project, undoStack } = get();
    const prevProjectCloned = cloneProject(project);
    const nextProject = cloneProject(project);

    const section = nextProject.content.sections.find((s) => s.id === sectionId);
    if (section) {
      Object.assign(section, updates);

      const solved = solveLayout(nextProject);
      nextProject.layout.elements = solved.elements;
      nextProject.layout.score = solved.score;
      nextProject.layout.warnings = solved.warnings;

      set({
        project: nextProject,
        undoStack: [...undoStack, prevProjectCloned],
        redoStack: [],
        hasUnsavedChanges: true,
      });
    }
  },

  updateItem: (itemId, updates) => {
    const { project, undoStack } = get();
    const prevProjectCloned = cloneProject(project);
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
      const solved = solveLayout(nextProject);
      nextProject.layout.elements = solved.elements;
      nextProject.layout.score = solved.score;
      nextProject.layout.warnings = solved.warnings;

      set({
        project: nextProject,
        undoStack: [...undoStack, prevProjectCloned],
        redoStack: [],
        hasUnsavedChanges: true,
      });
    }
  },

  reorderSections: (sectionIds) => {
    const { project, undoStack } = get();
    const prevProjectCloned = cloneProject(project);
    const nextProject = cloneProject(project);

    const sections = [...nextProject.content.sections];
    const orderedSections = sectionIds
      .map((id) => sections.find((s) => s.id === id))
      .filter((s): s is Section => !!s);

    // Append any that were not in the sectionIds list
    sections.forEach((s) => {
      if (!orderedSections.find((os) => os.id === s.id)) {
        orderedSections.push(s);
      }
    });

    // Update section ordering fields
    orderedSections.forEach((s, idx) => {
      s.order = idx;
    });

    nextProject.content.sections = orderedSections;

    const solved = solveLayout(nextProject);
    nextProject.layout.elements = solved.elements;
    nextProject.layout.score = solved.score;
    nextProject.layout.warnings = solved.warnings;

    set({
      project: nextProject,
      undoStack: [...undoStack, prevProjectCloned],
      redoStack: [],
      hasUnsavedChanges: true,
    });
  },

  reorderItems: (sectionId, itemIds) => {
    const { project, undoStack } = get();
    const prevProjectCloned = cloneProject(project);
    const nextProject = cloneProject(project);

    const section = nextProject.content.sections.find((s) => s.id === sectionId);
    if (section) {
      const items = [...section.items];
      const orderedItems = itemIds
        .map((id) => items.find((it) => it.id === id))
        .filter((it): it is Item => !!it);

      // Append any that were not in the itemIds list
      items.forEach((it) => {
        if (!orderedItems.find((oi) => oi.id === it.id)) {
          orderedItems.push(it);
        }
      });

      section.items = orderedItems;

      const solved = solveLayout(nextProject);
      nextProject.layout.elements = solved.elements;
      nextProject.layout.score = solved.score;
      nextProject.layout.warnings = solved.warnings;

      set({
        project: nextProject,
        undoStack: [...undoStack, prevProjectCloned],
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

  undo: () => {
    set((state) => {
      if (state.undoStack.length === 0) return {};
      const nextUndoStack = [...state.undoStack];
      const poppedProject = nextUndoStack.pop()!;
      return {
        project: poppedProject,
        undoStack: nextUndoStack,
        redoStack: [...state.redoStack, cloneProject(state.project)],
        hasUnsavedChanges: true,
      };
    });
  },

  redo: () => {
    set((state) => {
      if (state.redoStack.length === 0) return {};
      const nextRedoStack = [...state.redoStack];
      const poppedProject = nextRedoStack.pop()!;
      return {
        project: poppedProject,
        undoStack: [...state.undoStack, cloneProject(state.project)],
        redoStack: nextRedoStack,
        hasUnsavedChanges: true,
      };
    });
  },

  saveProject: async () => {
    const project = get().project;
    set({ isSaving: true });
    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(project),
      });

      if (!response.ok) {
        throw new Error(`Failed to save project. Status: ${response.status}`);
      }

      set({ isSaving: false, hasUnsavedChanges: false });
    } catch (error) {
      console.error('Error saving project:', error);
      set({ isSaving: false });
      throw error;
    }
  },
}));
