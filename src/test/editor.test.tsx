import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useEditorStore } from '@/lib/store/editorStore';
import { CANVAS_PRESETS } from '@/components/editor/LeftSidebar';
import { calculateNormalizedCoords } from '@/lib/utils/crop';
import { Project, Asset } from '@/lib/schemas/project';

// Simple mock project for testing
const mockProject: Project = {
  id: 'test_project_123',
  name: 'Test Project',
  schemaVersion: '1.0.0',
  type: 'inventory_board',
  canvas: {
    id: 'letter',
    name: 'Letter (8.5" x 11")',
    widthPx: 2550,
    heightPx: 3300,
    dpi: 300,
    safeMarginPx: 120,
    unit: 'in',
  },
  brand: {
    id: 'test_brand',
    brandName: 'Test Brand',
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
    headline: 'Welcome Headline',
    subheadline: 'Subheadline subtitle',
    sections: [
      {
        id: 'sec_1',
        title: 'Section One',
        subtitle: 'Sub One',
        priority: 'normal',
        layoutHint: 'grid',
        order: 0,
        items: [
          {
            id: 'item_1',
            sectionId: 'sec_1',
            title: 'Item One',
            subtitle: 'Sub Item One',
            description: 'Description One',
            price: 10,
            priceDisplay: '$10',
            salePrice: null,
            badge: null,
            imageAssetId: 'asset_1',
            priority: 'normal',
            visibility: 'visible',
            layoutHints: {
              cardSize: 'normal',
              imageFit: 'contain',
              preferredAspectRatio: '4:3',
            },
            metadata: { tags: [] },
          },
          {
            id: 'item_2',
            sectionId: 'sec_1',
            title: 'Item Two',
            subtitle: 'Sub Item Two',
            description: 'Description Two',
            price: 20,
            priceDisplay: '$20',
            salePrice: null,
            badge: null,
            imageAssetId: null,
            priority: 'normal',
            visibility: 'visible',
            layoutHints: {
              cardSize: 'normal',
              imageFit: 'contain',
              preferredAspectRatio: '4:3',
            },
            metadata: { tags: [] },
          },
        ],
      },
      {
        id: 'sec_2',
        title: 'Section Two',
        subtitle: 'Sub Two',
        priority: 'normal',
        layoutHint: 'grid',
        order: 1,
        items: [
          {
            id: 'item_3',
            sectionId: 'sec_2',
            title: 'Item Three',
            subtitle: 'Sub Item Three',
            description: 'Description Three',
            price: 30,
            priceDisplay: '$30',
            salePrice: null,
            badge: null,
            imageAssetId: null,
            priority: 'normal',
            visibility: 'visible',
            layoutHints: {
              cardSize: 'normal',
              imageFit: 'contain',
              preferredAspectRatio: '4:3',
            },
            metadata: { tags: [] },
          },
        ],
      },
    ],
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

const mockAssets: Asset[] = [
  {
    id: 'asset_1',
    name: 'Asset 1',
    type: 'image',
    filePath: '/images/asset1.png',
    thumbnailPath: null,
    mimeType: 'image/png',
    sizeBytes: 1024,
    dimensions: { width: 100, height: 100 },
    focalPoint: { x: 0.5, y: 0.5 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

describe('Zustand Editor Store', () => {
  beforeEach(() => {
    // Reset Zustand store state before each test
    useEditorStore.setState({
      project: JSON.parse(JSON.stringify(mockProject)),
      assets: [...mockAssets],
      selectedElementId: null,
      zoom: 0.75,
      undoStack: [],
      redoStack: [],
      isSaving: false,
      hasUnsavedChanges: false,
    });
  });

  it('should initialize state correctly using setProject', () => {
    const store = useEditorStore.getState();
    const otherProject = {
      ...mockProject,
      id: 'other_id',
      name: 'Other Project Name',
    };

    store.setProject(otherProject, mockAssets);

    const updatedState = useEditorStore.getState();
    expect(updatedState.project.id).toBe('other_id');
    expect(updatedState.project.name).toBe('Other Project Name');
    expect(updatedState.assets).toHaveLength(1);
    expect(updatedState.undoStack).toHaveLength(0);
    expect(updatedState.redoStack).toHaveLength(0);
    expect(updatedState.hasUnsavedChanges).toBe(false);
  });

  it('should update project fields using updateProjectField and maintain history', () => {
    const store = useEditorStore.getState();
    
    // Update name
    store.updateProjectField('name', 'Updated Name');
    let state = useEditorStore.getState();
    expect(state.project.name).toBe('Updated Name');
    expect(state.undoStack).toHaveLength(1);
    expect(state.undoStack[0].name).toBe('Test Project');
    expect(state.redoStack).toHaveLength(0);
    expect(state.hasUnsavedChanges).toBe(true);

    // Update nested brand color
    store.updateProjectField('brand.colors.primary', '#ff0000');
    state = useEditorStore.getState();
    expect(state.project.brand.colors.primary).toBe('#ff0000');
    expect(state.undoStack).toHaveLength(2);
    expect(state.undoStack[1].name).toBe('Updated Name');
  });

  it('should handle undo and redo properly', () => {
    const store = useEditorStore.getState();

    // 1. Initial State: Name = "Test Project"
    store.updateProjectField('name', 'Edit One'); // undoStack = ["Test Project"]
    store.updateProjectField('name', 'Edit Two'); // undoStack = ["Test Project", "Edit One"]

    let state = useEditorStore.getState();
    expect(state.project.name).toBe('Edit Two');
    expect(state.undoStack).toHaveLength(2);

    // 2. Undo once
    store.undo(); // project = "Edit One", redoStack = ["Edit Two"]
    state = useEditorStore.getState();
    expect(state.project.name).toBe('Edit One');
    expect(state.undoStack).toHaveLength(1);
    expect(state.redoStack).toHaveLength(1);
    expect(state.redoStack[0].name).toBe('Edit Two');

    // 3. Undo again
    store.undo(); // project = "Test Project", redoStack = ["Edit Two", "Edit One"]
    state = useEditorStore.getState();
    expect(state.project.name).toBe('Test Project');
    expect(state.undoStack).toHaveLength(0);
    expect(state.redoStack).toHaveLength(2);

    // 4. Redo once
    store.redo(); // project = "Edit One", undoStack = ["Test Project"]
    state = useEditorStore.getState();
    expect(state.project.name).toBe('Edit One');
    expect(state.undoStack).toHaveLength(1);
    expect(state.redoStack).toHaveLength(1);

    // 5. Redo again
    store.redo(); // project = "Edit Two", undoStack = ["Test Project", "Edit One"]
    state = useEditorStore.getState();
    expect(state.project.name).toBe('Edit Two');
    expect(state.undoStack).toHaveLength(2);
    expect(state.redoStack).toHaveLength(0);
  });

  it('should update section properties', () => {
    const store = useEditorStore.getState();

    store.updateSection('sec_1', { title: 'New Section Title', priority: 'high' });

    const state = useEditorStore.getState();
    const sec1 = state.project.content.sections.find((s) => s.id === 'sec_1');
    expect(sec1?.title).toBe('New Section Title');
    expect(sec1?.priority).toBe('high');
    expect(state.undoStack).toHaveLength(1);
    expect(state.hasUnsavedChanges).toBe(true);
  });

  it('should update item properties', () => {
    const store = useEditorStore.getState();

    store.updateItem('item_1', { title: 'New Item Title', price: 99.99 });

    const state = useEditorStore.getState();
    const item1 = state.project.content.sections[0].items.find((it) => it.id === 'item_1');
    expect(item1?.title).toBe('New Item Title');
    expect(item1?.price).toBe(99.99);
    expect(state.undoStack).toHaveLength(1);
  });

  it('should reorder sections and update layouts', () => {
    const store = useEditorStore.getState();

    // Current order: sec_1, sec_2. Reorder to sec_2, sec_1
    store.reorderSections(['sec_2', 'sec_1']);

    const state = useEditorStore.getState();
    expect(state.project.content.sections[0].id).toBe('sec_2');
    expect(state.project.content.sections[1].id).toBe('sec_1');
    // Orders should be updated
    expect(state.project.content.sections[0].order).toBe(0);
    expect(state.project.content.sections[1].order).toBe(1);
    expect(state.undoStack).toHaveLength(1);
  });

  it('should reorder items within a section', () => {
    const store = useEditorStore.getState();

    // Current items in sec_1: item_1, item_2. Reorder to item_2, item_1
    store.reorderItems('sec_1', ['item_2', 'item_1']);

    const state = useEditorStore.getState();
    const section1 = state.project.content.sections.find((s) => s.id === 'sec_1');
    expect(section1?.items[0].id).toBe('item_2');
    expect(section1?.items[1].id).toBe('item_1');
    expect(state.undoStack).toHaveLength(1);
  });

  it('should support selection and zoom changes without saving to history', () => {
    const store = useEditorStore.getState();

    store.setZoom(1.5);
    store.selectElement('item_1');

    const state = useEditorStore.getState();
    expect(state.zoom).toBe(1.5);
    expect(state.selectedElementId).toBe('item_1');
    expect(state.undoStack).toHaveLength(0);
    expect(state.hasUnsavedChanges).toBe(false);
  });

  it('should calculate canvas dimensions correctly when preset is updated', () => {
    const store = useEditorStore.getState();
    
    // Choose poster preset
    const posterPreset = CANVAS_PRESETS.find((p) => p.id === 'poster')!;
    store.updateProjectField('canvas', {
      id: posterPreset.id,
      name: posterPreset.name,
      widthPx: posterPreset.widthPx,
      heightPx: posterPreset.heightPx,
      dpi: posterPreset.dpi,
      safeMarginPx: posterPreset.safeMarginPx,
      unit: posterPreset.unit,
    });

    const state = useEditorStore.getState();
    expect(state.project.canvas.id).toBe('poster');
    expect(state.project.canvas.widthPx).toBe(3600);
    expect(state.project.canvas.heightPx).toBe(5400);
    expect(state.project.canvas.safeMarginPx).toBe(180);
  });

  it('should mock API calls during saveProject', async () => {
    const store = useEditorStore.getState();
    store.updateProjectField('name', 'Savable Project');

    // Mock global fetch
    const originalFetch = global.fetch;
    const mockFetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      })
    );
    global.fetch = mockFetch;

    try {
      await store.saveProject();

      const state = useEditorStore.getState();
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(state.isSaving).toBe(false);
      expect(state.hasUnsavedChanges).toBe(false);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should update layout elements using updateLayoutElements, mark as locked on change, run solver, and maintain history', () => {
    const store = useEditorStore.getState();
    
    store.updateProjectField('name', 'Trigger Solve');
    let state = useEditorStore.getState();
    const firstElement = state.project.layout.elements[0];
    expect(firstElement).toBeDefined();
    expect(firstElement.locked).toBe(false);

    const originalX = firstElement.x;
    const originalY = firstElement.y;
    const targetX = originalX + 10;
    const targetY = originalY + 15;

    store.updateLayoutElements([{ id: firstElement.id, x: targetX, y: targetY }]);

    state = useEditorStore.getState();
    const updatedElement = state.project.layout.elements.find(el => el.id === firstElement.id);
    expect(updatedElement).toBeDefined();
    expect(updatedElement!.x).toBe(targetX);
    expect(updatedElement!.y).toBe(targetY);
    expect(updatedElement!.locked).toBe(true);
    expect(state.undoStack).toHaveLength(2);
  });

  it('should initialize layoutVariants and activeVariantId in setProject if missing', () => {
    const store = useEditorStore.getState();
    const cleanProject = {
      ...mockProject,
      layoutVariants: undefined,
      activeVariantId: undefined,
    } as unknown as Project;

    store.setProject(cleanProject, mockAssets);
    const state = useEditorStore.getState();
    expect(state.activeVariantId).toBeNull();
    expect(state.layoutVariants).toEqual([]);
  });

  it('should support creating, duplicating, deleting and applying variants', () => {
    const store = useEditorStore.getState();
    store.setProject(mockProject, mockAssets);

    // Create a variant
    store.createVariant('Variant A', 'inventory_board', 'dense');
    let state = useEditorStore.getState();
    expect(state.layoutVariants).toHaveLength(1);
    const variantA = state.layoutVariants[0];
    expect(variantA.name).toBe('Variant A');
    expect(variantA.density).toBe('dense');

    // Duplicate variant
    store.duplicateVariant(variantA.id);
    state = useEditorStore.getState();
    expect(state.layoutVariants).toHaveLength(2);
    const duplicate = state.layoutVariants.find((v) => v.id !== variantA.id);
    expect(duplicate).toBeDefined();
    expect(duplicate!.name).toBe('Variant A (Copy)');

    // Select active variant
    store.selectActiveVariant(variantA.id);
    state = useEditorStore.getState();
    expect(state.activeVariantId).toBe(variantA.id);
    expect(state.project.layout.density).toBe('dense');

    // Apply active variant as primary
    store.applyVariantAsPrimary(variantA.id);
    state = useEditorStore.getState();
    expect(state.primaryLayout.density).toBe('dense');
    expect(state.activeVariantId).toBeNull();

    // Delete variant
    store.deleteVariant(variantA.id);
    state = useEditorStore.getState();
    expect(state.layoutVariants).toHaveLength(1);
    expect(state.layoutVariants[0].name).toBe('Variant A (Copy)');
  });

  it('should duplicate the primary layout when duplicateVariant(null) is called', () => {
    useEditorStore.getState().setProject(mockProject, mockAssets);

    let state = useEditorStore.getState();
    // Initial state: no variant, activeVariantId is null
    expect(state.activeVariantId).toBeNull();
    expect(state.layoutVariants).toHaveLength(0);

    // Set some custom values on primary layout to verify duplicate uses them
    useEditorStore.setState({
      primaryLayout: {
        ...mockProject.layout,
        layoutFamily: 'inventory_board',
        density: 'dense',
        elements: [{ id: 'el-1', type: 'text', contentRef: 'headline', x: 10, y: 20, width: 100, height: 50, locked: false, style: {} }],
        warnings: ['Some warning'],
      },
    });

    // Call duplicateVariant(null)
    useEditorStore.getState().duplicateVariant(null);
    state = useEditorStore.getState();

    // Verify duplicate is created
    expect(state.layoutVariants).toHaveLength(1);
    const duplicated = state.layoutVariants[0];
    expect(duplicated.name).toBe('Primary Layout (Copy)');
    expect(duplicated.layoutFamily).toBe('inventory_board');
    expect(duplicated.density).toBe('dense');
    expect(duplicated.elements).toHaveLength(1);
    expect(duplicated.elements[0].id).toBe('el-1');
    expect(duplicated.warnings).toContain('Some warning');
  });

  it('should set comparisonVariantId for compare mode', () => {
    const store = useEditorStore.getState();
    expect(store.comparisonVariantId).toBeNull();

    store.selectComparisonVariant('variant-a');
    let state = useEditorStore.getState();
    expect(state.comparisonVariantId).toBe('variant-a');

    store.selectComparisonVariant(null);
    state = useEditorStore.getState();
    expect(state.comparisonVariantId).toBeNull();
  });
});

describe('Focal Crop Click Coordinate Math', () => {
  it('should accurately calculate normalized coordinates', () => {
    const rect = { left: 100, top: 50, width: 200, height: 150 };

    // Center click
    let coords = calculateNormalizedCoords(200, 125, rect);
    expect(coords.x).toBeCloseTo(0.5);
    expect(coords.y).toBeCloseTo(0.5);

    // Top left click
    coords = calculateNormalizedCoords(100, 50, rect);
    expect(coords.x).toBe(0);
    expect(coords.y).toBe(0);

    // Bottom right click
    coords = calculateNormalizedCoords(300, 200, rect);
    expect(coords.x).toBe(1);
    expect(coords.y).toBe(1);

    // Out of bounds click (should clamp)
    coords = calculateNormalizedCoords(50, 20, rect); // Left and above
    expect(coords.x).toBe(0);
    expect(coords.y).toBe(0);

    coords = calculateNormalizedCoords(400, 300, rect); // Right and below
    expect(coords.x).toBe(1);
    expect(coords.y).toBe(1);
  });

  it('should handle division by zero/negative bounds gracefully', () => {
    const rect = { left: 100, top: 50, width: 0, height: 0 };
    const coords = calculateNormalizedCoords(200, 125, rect);
    expect(coords.x).toBe(0.5);
    expect(coords.y).toBe(0.5);
  });
});
