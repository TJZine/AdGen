import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { EditorWorkspace } from '../components/editor/EditorWorkspace';
import { useEditorStore } from '../lib/store/editorStore';
import { Project, Asset } from '../lib/schemas/project';

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
    finalFormats: ['png'],
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
  layoutVariants: [
    {
      id: 'var-1',
      name: 'Variant One',
      layoutFamily: 'inventory_board',
      density: 'loose',
      elements: [],
      score: 90,
      warnings: [],
    },
    {
      id: 'var-2',
      name: 'Variant Two',
      layoutFamily: 'inventory_board',
      density: 'dense',
      elements: [],
      score: 85,
      warnings: [],
    },
  ],
  activeVariantId: null,
};

const mockAssets: Asset[] = [];

describe('EditorWorkspace Split-Screen UI', () => {
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
      layoutVariants: [...mockProject.layoutVariants],
      activeVariantId: null,
      comparisonVariantId: null,
    });
  });

  const enterCanvasMode = () => {
    const canvasBtn = screen.getByTestId('mode-canvas-btn');
    fireEvent.click(canvasBtn);
  };

  it('renders split screen panels when comparison mode is active', () => {
    render(<EditorWorkspace initialProject={mockProject} initialAssets={mockAssets} />);
    enterCanvasMode();

    // Toggle comparison checkbox
    const compareCheckbox = screen.getByTestId('compare-variants-checkbox');
    expect(compareCheckbox).not.toBeChecked();

    fireEvent.click(compareCheckbox);

    // Verify side-by-side viewports and container are rendered
    expect(screen.getByTestId('compare-split-container')).toBeInTheDocument();
    expect(screen.getByTestId('left-viewport-panel')).toBeInTheDocument();
    expect(screen.getByTestId('right-viewport-panel')).toBeInTheDocument();

    // Verify left and right dropdown selects are rendered
    expect(screen.getByTestId('left-viewport-select')).toBeInTheDocument();
    expect(screen.getByTestId('right-viewport-select')).toBeInTheDocument();
  });

  it('swaps active and comparison variants when left dropdown selects the current comparison variant', () => {
    render(<EditorWorkspace initialProject={mockProject} initialAssets={mockAssets} />);
    enterCanvasMode();

    // Wait for component to mount and first render to finish (useEffect has run)
    expect(screen.getByTestId('canvas-preview-container')).toBeInTheDocument();

    // Setup state after rendering to avoid useEffect reset
    act(() => {
      useEditorStore.setState({
        activeVariantId: null, // Left is primary
        comparisonVariantId: 'var-1', // Right is Variant One
      });
    });

    const leftSelect = screen.getByTestId('left-viewport-select') as HTMLSelectElement;
    const rightSelect = screen.getByTestId('right-viewport-select') as HTMLSelectElement;

    expect(leftSelect.value).toBe('primary');
    expect(rightSelect.value).toBe('var-1');

    // Change left select to 'var-1' (which is the current comparison variant)
    fireEvent.change(leftSelect, { target: { value: 'var-1' } });

    // Both should swap
    expect(useEditorStore.getState().activeVariantId).toBe('var-1');
    expect(useEditorStore.getState().comparisonVariantId).toBeNull(); // was null (primary)
  });

  it('swaps active and comparison variants when right dropdown selects the current active variant', () => {
    render(<EditorWorkspace initialProject={mockProject} initialAssets={mockAssets} />);
    enterCanvasMode();

    // Wait for component to mount and first render to finish
    expect(screen.getByTestId('canvas-preview-container')).toBeInTheDocument();

    // Setup state after rendering
    act(() => {
      useEditorStore.setState({
        activeVariantId: 'var-1', // Left is Variant One
        comparisonVariantId: 'var-2', // Right is Variant Two
      });
    });

    const leftSelect = screen.getByTestId('left-viewport-select') as HTMLSelectElement;
    const rightSelect = screen.getByTestId('right-viewport-select') as HTMLSelectElement;

    expect(leftSelect.value).toBe('var-1');
    expect(rightSelect.value).toBe('var-2');

    // Change right select to 'var-1' (which is the current active variant)
    fireEvent.change(rightSelect, { target: { value: 'var-1' } });

    // Both should swap
    expect(useEditorStore.getState().activeVariantId).toBe('var-2');
    expect(useEditorStore.getState().comparisonVariantId).toBe('var-1');
  });

  it('focuses/selects the left panel when clicked without swapping', () => {
    render(<EditorWorkspace initialProject={mockProject} initialAssets={mockAssets} />);
    enterCanvasMode();

    // Wait for component to mount and first render to finish
    expect(screen.getByTestId('canvas-preview-container')).toBeInTheDocument();

    // Setup state after rendering
    act(() => {
      useEditorStore.setState({
        activeVariantId: 'var-1',
        comparisonVariantId: 'var-2',
      });
    });

    const leftPanel = screen.getByTestId('left-viewport-panel');
    fireEvent.click(leftPanel);

    // Left should remain var-1, Right should remain var-2
    expect(useEditorStore.getState().activeVariantId).toBe('var-1');
    expect(useEditorStore.getState().comparisonVariantId).toBe('var-2');
  });

  it('swaps variants when the right panel is clicked to focus/select it', () => {
    render(<EditorWorkspace initialProject={mockProject} initialAssets={mockAssets} />);
    enterCanvasMode();

    // Wait for component to mount and first render to finish
    expect(screen.getByTestId('canvas-preview-container')).toBeInTheDocument();

    // Setup state after rendering
    act(() => {
      useEditorStore.setState({
        activeVariantId: 'var-1',
        comparisonVariantId: 'var-2',
      });
    });

    const rightPanel = screen.getByTestId('right-viewport-panel');
    fireEvent.click(rightPanel);

    // Left and Right should swap so that 'var-2' (focused) is now active (left) and 'var-1' is comparison (right)
    expect(useEditorStore.getState().activeVariantId).toBe('var-2');
    expect(useEditorStore.getState().comparisonVariantId).toBe('var-1');
  });

  it('duplicates the primary layout when clicking duplicate button and no active variant is selected', () => {
    render(<EditorWorkspace initialProject={mockProject} initialAssets={mockAssets} />);
    enterCanvasMode();

    // Setup state so that layoutVariants has 2 items and activeVariantId is null (primary is active)
    act(() => {
      useEditorStore.setState({
        layoutVariants: [...mockProject.layoutVariants],
        activeVariantId: null,
      });
    });

    const duplicateBtn = screen.getByTestId('duplicate-variant-btn');
    expect(duplicateBtn).toBeEnabled();

    // Click duplicate button
    fireEvent.click(duplicateBtn);

    // Verify a new layout variant was added
    const state = useEditorStore.getState();
    expect(state.layoutVariants).toHaveLength(3);
    const newVariant = state.layoutVariants[2];
    expect(newVariant.name).toBe('Primary Layout (Copy)');
    // It should have copied the primary layout details
    expect(newVariant.layoutFamily).toBe(state.primaryLayout.layoutFamily);
    expect(newVariant.density).toBe(state.primaryLayout.density);
  });

  it('disables duplicate button when layout variants count is at least 5', () => {
    render(<EditorWorkspace initialProject={mockProject} initialAssets={mockAssets} />);
    enterCanvasMode();

    act(() => {
      useEditorStore.setState({
        layoutVariants: [
          { id: 'v1', name: 'V1', layoutFamily: 'inventory_board', density: 'normal', elements: [], score: 100, warnings: [] },
          { id: 'v2', name: 'V2', layoutFamily: 'inventory_board', density: 'normal', elements: [], score: 100, warnings: [] },
          { id: 'v3', name: 'V3', layoutFamily: 'inventory_board', density: 'normal', elements: [], score: 100, warnings: [] },
          { id: 'v4', name: 'V4', layoutFamily: 'inventory_board', density: 'normal', elements: [], score: 100, warnings: [] },
          { id: 'v5', name: 'V5', layoutFamily: 'inventory_board', density: 'normal', elements: [], score: 100, warnings: [] },
        ],
        activeVariantId: null,
      });
    });

    const duplicateBtn = screen.getByTestId('duplicate-variant-btn');
    expect(duplicateBtn).toBeDisabled();
  });
});
