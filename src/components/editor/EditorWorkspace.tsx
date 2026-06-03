"use client";

import React, { useEffect, useState } from 'react';
import { useEditorStore } from '@/lib/store/editorStore';
import { LeftSidebar } from './LeftSidebar';
import { RightInspector } from './RightInspector';
import { ContentTableMode } from './ContentTableMode';
import { BackgroundRenderer } from '../renderer/BackgroundRenderer';
import { OverlayRenderer } from '../renderer/OverlayRenderer';
import { ContrastGuard } from './ContrastGuard';
import { CanvasPreview } from '../renderer/CanvasPreview';
import { Project, Asset } from '@/lib/schemas/project';
import { getNumSlides } from '@/lib/layout/solver';

interface EditorWorkspaceProps {
  initialProject: Project;
  initialAssets: Asset[];
}

export const EditorWorkspace: React.FC<EditorWorkspaceProps> = ({
  initialProject,
  initialAssets,
}) => {
  const {
    project,
    assets,
    zoom,
    undoStack,
    redoStack,
    isSaving,
    hasUnsavedChanges,
    setProject,
    updateProjectField,
    setZoom,
    undo,
    redo,
    saveProject,
    layoutVariants,
    activeVariantId,
    comparisonVariantId,
    createVariant,
    duplicateVariant,
    deleteVariant,
    selectActiveVariant,
    selectComparisonVariant,
    applyVariantAsPrimary,
    primaryLayout,
    primaryPolishedBackground,
  } = useEditorStore();

  const getProjectForVariant = (vId: string | null): Project => {
    if (!vId) {
      return {
        ...project,
        layout: primaryLayout,
        polishedBackground: primaryPolishedBackground,
      };
    }
    const variant = layoutVariants.find((v) => v.id === vId);
    if (!variant) return project;
    return {
      ...project,
      layout: {
        ...project.layout,
        layoutFamily: variant.layoutFamily,
        density: variant.density,
        elements: variant.elements,
        score: variant.score,
        warnings: variant.warnings,
      },
      polishedBackground: variant.polishedBackground || project.polishedBackground,
    };
  };

  const [mode, setMode] = useState<'content' | 'canvas'>('content');

  // Initialize store with initialProject and assets, preserving URL parameters
  useEffect(() => {
    if (!project.id || project.id !== initialProject.id) {
      setProject(initialProject, initialAssets);

      // Restore settings from URL parameters on mount
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        
        const urlZoom = params.get('zoom');
        if (urlZoom) {
          const parsedZoom = parseFloat(urlZoom);
          if (Number.isFinite(parsedZoom) && parsedZoom > 0) {
            setZoom(parsedZoom);
          }
        }
        
        const urlVariant = params.get('variant');
        if (urlVariant) {
          selectActiveVariant(urlVariant === 'primary' ? null : urlVariant);
        }
        
        const urlCompare = params.get('compare');
        if (urlCompare) {
          selectComparisonVariant(urlCompare === 'primary' ? null : urlCompare);
        }
      }
    }
  }, [initialProject, initialAssets, project.id, setProject, setZoom, selectActiveVariant, selectComparisonVariant]);

  // Synchronize zoom, activeVariant, and comparisonVariant to URL query parameters
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    
    params.set('zoom', zoom.toString());
    params.set('variant', activeVariantId || 'primary');
    if (comparisonVariantId) {
      params.set('compare', comparisonVariantId);
    } else {
      params.delete('compare');
    }
    
    const newSearch = params.toString();
    const newUrl = `${window.location.pathname}?${newSearch}`;
    window.history.replaceState(null, '', newUrl);
  }, [zoom, activeVariantId, comparisonVariantId]);

  // Synchronize browser Back/Forward (popstate) actions back into Zustand store
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      
      const urlZoom = params.get('zoom');
      if (urlZoom) {
        const parsedZoom = parseFloat(urlZoom);
        if (Number.isFinite(parsedZoom) && parsedZoom > 0) {
          setZoom(parsedZoom);
        }
      }
      
      const urlVariant = params.get('variant');
      selectActiveVariant(urlVariant === 'primary' || !urlVariant ? null : urlVariant);
      
      const urlCompare = params.get('compare');
      selectComparisonVariant(urlCompare === 'primary' || !urlCompare ? null : urlCompare);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [setZoom, selectActiveVariant, selectComparisonVariant]);

  // Prevent loss of unsaved changes when closing or reloading the browser tab
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);


  const numSlides = getNumSlides(project);

  return (
    <div className="flex flex-col h-screen w-screen bg-zinc-100 overflow-hidden font-sans select-none">
      {/* Top Navbar */}
      <header className="h-14 bg-white border-b border-zinc-200 px-5 flex items-center justify-between shrink-0 shadow-sm z-10">
        {/* Left: Project title and save state */}
        <div className="flex items-center gap-4">
          <input
            type="text"
            data-testid="project-name-input"
            value={project.name || ''}
            onChange={(e) => updateProjectField('name', e.target.value)}
            placeholder="Untitled Project"
            className="text-base font-semibold text-zinc-900 border border-transparent hover:border-zinc-300 focus:border-zinc-500 rounded px-2.5 py-1 bg-white focus:outline-none w-64"
          />
          <div className="text-xs">
            {isSaving ? (
              <span className="text-zinc-500 flex items-center gap-1.5 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-500"></span>
                Saving...
              </span>
            ) : hasUnsavedChanges ? (
              <span className="text-amber-600 flex items-center gap-1.5 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                Unsaved changes
              </span>
            ) : (
              <span className="text-emerald-600 flex items-center gap-1.5 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Saved
              </span>
            )}
          </div>
        </div>

        {/* Center: Mode Selector */}
        <div className="flex bg-zinc-100 p-0.5 rounded-md border border-zinc-200">
          <button
            type="button"
            data-testid="mode-content-btn"
            onClick={() => setMode('content')}
            className={`px-4 py-1.5 rounded text-xs font-semibold tracking-wide uppercase transition ${
              mode === 'content'
                ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            Content Table
          </button>
          <button
            type="button"
            data-testid="mode-canvas-btn"
            onClick={() => setMode('canvas')}
            className={`px-4 py-1.5 rounded text-xs font-semibold tracking-wide uppercase transition ${
              mode === 'canvas'
                ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            Canvas Preview
          </button>
        </div>

        {/* Right: Actions (Undo/Redo, Zoom, Save) */}
        <div className="flex items-center gap-3">
          {/* Zoom controls */}
          <div className="flex items-center gap-2 border border-zinc-200 rounded px-2.5 py-1 bg-white">
            <span className="text-xs text-zinc-400 font-semibold select-none uppercase tracking-wide">Zoom</span>
            <select
              value={zoom}
              data-testid="zoom-select"
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="text-xs font-medium text-zinc-700 bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="0.25">25%</option>
              <option value="0.5">50%</option>
              <option value="0.75">75%</option>
              <option value="1">100%</option>
              <option value="1.25">125%</option>
              <option value="1.5">150%</option>
            </select>
          </div>

          <div className="w-px h-5 bg-zinc-200" />

          {/* History buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              data-testid="undo-btn"
              onClick={undo}
              disabled={undoStack.length === 0}
              className="p-1.5 border border-zinc-300 rounded bg-white hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-white text-zinc-700 transition"
              title="Undo"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
              </svg>
            </button>
            <button
              type="button"
              data-testid="redo-btn"
              onClick={redo}
              disabled={redoStack.length === 0}
              className="p-1.5 border border-zinc-300 rounded bg-white hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-white text-zinc-700 transition"
              title="Redo"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
              </svg>
            </button>
          </div>

          {/* Save button */}
          <button
            type="button"
            data-testid="save-btn"
            onClick={saveProject}
            disabled={isSaving || !hasUnsavedChanges}
            className="px-4 py-1.5 bg-zinc-950 text-white rounded text-xs font-semibold tracking-wider uppercase hover:bg-zinc-800 disabled:opacity-45 disabled:hover:bg-zinc-950 transition cursor-pointer"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <LeftSidebar />

        {/* Workspace Central Area */}
        {mode === 'content' ? (
          <ContentTableMode />
        ) : (
          <div className="flex-1 flex flex-col bg-zinc-100 overflow-hidden">
            {/* Variant Toolbar */}
            <div
              data-testid="variant-toolbar"
              className="h-12 bg-white border-b border-zinc-200 px-4 flex items-center justify-between shrink-0 gap-4 text-zinc-700 text-xs font-medium"
            >
              {/* Left: Active Variant actions */}
              <div className="flex items-center gap-3">
                <span className="text-zinc-500 font-semibold select-none uppercase tracking-wider">Active Variant</span>
                <select
                  data-testid="active-variant-select"
                  value={activeVariantId || 'primary'}
                  onChange={(e) => {
                    const val = e.target.value;
                    selectActiveVariant(val === 'primary' ? null : val);
                  }}
                  className="border border-zinc-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-zinc-500 cursor-pointer max-w-xs"
                >
                  <option value="primary">Primary Layout</option>
                  {layoutVariants.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.name}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  data-testid="create-variant-btn"
                  onClick={() => {
                    const name = prompt('Enter variant name:', `Variant ${layoutVariants.length + 1}`);
                    if (!name) return;
                    createVariant(name, project.layout.layoutFamily, project.layout.density);
                  }}
                  disabled={layoutVariants.length >= 5}
                  className="px-2.5 py-1 border border-zinc-300 rounded hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-white text-zinc-700 bg-white font-semibold transition cursor-pointer"
                  title="Create new variant"
                >
                  Create Variant
                </button>

                <button
                  type="button"
                  data-testid="duplicate-variant-btn"
                  onClick={() => {
                    if (activeVariantId === null) {
                      duplicateVariant(null);
                    } else {
                      duplicateVariant(activeVariantId);
                    }
                  }}
                  disabled={layoutVariants.length >= 5}
                  className="px-2.5 py-1 border border-zinc-300 rounded hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-white transition cursor-pointer text-zinc-700 bg-white font-semibold"
                  title="Duplicate active variant"
                >
                  Duplicate
                </button>

                <button
                  type="button"
                  data-testid="delete-variant-btn"
                  onClick={() => {
                    if (activeVariantId) {
                      deleteVariant(activeVariantId);
                    }
                  }}
                  disabled={!activeVariantId}
                  className="px-2.5 py-1 border border-zinc-300 rounded hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-white text-rose-600 transition cursor-pointer bg-white font-semibold"
                  title="Delete active variant"
                >
                  Delete
                </button>

                {activeVariantId && (
                  <button
                    type="button"
                    data-testid="apply-primary-btn"
                    onClick={() => applyVariantAsPrimary(activeVariantId)}
                    className="px-2.5 py-1 border border-zinc-300 rounded hover:bg-zinc-50 transition cursor-pointer text-emerald-600 bg-white font-semibold"
                    title="Apply active variant layout as the primary project layout"
                  >
                    Apply as Primary
                  </button>
                )}
              </div>

              {/* Right: Variant Comparison */}
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    data-testid="compare-variants-checkbox"
                    checked={comparisonVariantId !== null}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      if (checked) {
                        const other = layoutVariants.find((v) => v.id !== activeVariantId) || layoutVariants[0];
                        selectComparisonVariant(other ? other.id : null);
                      } else {
                        selectComparisonVariant(null);
                      }
                    }}
                    className="rounded border-zinc-300 text-zinc-950 focus:ring-zinc-500 cursor-pointer"
                  />
                  <span>Compare Variants</span>
                </label>

                {comparisonVariantId !== null && (
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400 font-semibold select-none">A:</span>
                    <select
                      data-testid="compare-variant-a-select"
                      value={activeVariantId || 'primary'}
                      onChange={(e) => {
                        const val = e.target.value;
                        selectActiveVariant(val === 'primary' ? null : val);
                      }}
                      className="border border-zinc-300 rounded px-1.5 py-1 bg-white focus:outline-none cursor-pointer max-w-[120px]"
                    >
                      <option value="primary">Primary Layout</option>
                      {layoutVariants.map((variant) => (
                        <option key={variant.id} value={variant.id}>
                          {variant.name}
                        </option>
                      ))}
                    </select>

                    <span className="text-zinc-400 font-semibold select-none">B:</span>
                    <select
                      data-testid="compare-variant-b-select"
                      value={comparisonVariantId || 'primary'}
                      onChange={(e) => {
                        const val = e.target.value;
                        selectComparisonVariant(val === 'primary' ? null : val);
                      }}
                      className="border border-zinc-300 rounded px-1.5 py-1 bg-white focus:outline-none cursor-pointer max-w-[120px]"
                    >
                      <option value="primary">Primary Layout</option>
                      {layoutVariants.map((variant) => (
                        <option key={variant.id} value={variant.id}>
                          {variant.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Canvas Scrollable Area */}
            <div className="flex-1 overflow-auto p-8 flex items-center justify-center">
              {comparisonVariantId !== null ? (
                /* Comparison split screen layout */
                <div
                  data-testid="compare-split-container"
                  className="flex gap-8 items-start justify-center min-w-max p-4"
                >
                  {/* Left Panel */}
                  <div
                    data-testid="left-viewport-panel"
                    onClick={() => selectActiveVariant(activeVariantId)}
                    className="p-4 rounded-xl border border-blue-500 bg-white shadow-md flex flex-col items-center cursor-pointer transition ring-2 ring-blue-500/20"
                  >
                    {/* Header & Select Wrapper */}
                    <div className="w-full flex flex-col gap-1 mb-3 select-none">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                        Left Viewport Layout
                      </label>
                      <select
                        data-testid="left-viewport-select"
                        value={activeVariantId || 'primary'}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const val = e.target.value;
                          const targetId = val === 'primary' ? null : val;
                          if (targetId === comparisonVariantId) {
                            const prevActive = activeVariantId;
                            selectActiveVariant(targetId);
                            selectComparisonVariant(prevActive);
                          } else {
                            selectActiveVariant(targetId);
                          }
                        }}
                        className="border border-zinc-200 bg-white rounded-lg px-3 py-2 text-xs text-zinc-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer w-full transition"
                      >
                        <option value="primary">Primary Layout</option>
                        {layoutVariants.map((variant) => (
                          <option key={variant.id} value={variant.id}>
                            {variant.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {/* Canvas Preview Wrapper */}
                    <div className="p-2 border border-zinc-100 rounded-lg bg-zinc-50/50 shadow-inner flex items-center justify-center">
                      <CanvasPreview
                        project={getProjectForVariant(activeVariantId)}
                        assets={assets}
                        zoom={zoom}
                      />
                    </div>
                  </div>

                  {/* Right Panel */}
                  <div
                    data-testid="right-viewport-panel"
                    onClick={() => {
                      const prevActive = activeVariantId;
                      const prevComparison = comparisonVariantId;
                      selectActiveVariant(prevComparison);
                      selectComparisonVariant(prevActive);
                    }}
                    className="p-4 rounded-xl border border-zinc-200 bg-white shadow-sm flex flex-col items-center cursor-pointer transition hover:border-zinc-300 hover:shadow-md"
                  >
                    {/* Header & Select Wrapper */}
                    <div className="w-full flex flex-col gap-1 mb-3 select-none">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                        Right Viewport Layout
                      </label>
                      <select
                        data-testid="right-viewport-select"
                        value={comparisonVariantId || 'primary'}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const val = e.target.value;
                          const targetId = val === 'primary' ? null : val;
                          if (targetId === activeVariantId) {
                            const prevComparison = comparisonVariantId;
                            selectComparisonVariant(targetId);
                            selectActiveVariant(prevComparison);
                          } else {
                            selectComparisonVariant(targetId);
                          }
                        }}
                        className="border border-zinc-200 bg-white rounded-lg px-3 py-2 text-xs text-zinc-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer w-full transition"
                      >
                        <option value="primary">Primary Layout</option>
                        {layoutVariants.map((variant) => (
                          <option key={variant.id} value={variant.id}>
                            {variant.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {/* Canvas Preview Wrapper */}
                    <div className="p-2 border border-zinc-100 rounded-lg bg-zinc-50/50 shadow-inner flex items-center justify-center">
                      <CanvasPreview
                        project={getProjectForVariant(comparisonVariantId)}
                        assets={assets}
                        zoom={zoom}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                /* Aspect ratio-locked canvas preview with absolute scaling */
                <div
                  style={{
                    width: `${project.canvas.widthPx * numSlides * zoom}px`,
                    height: `${project.canvas.heightPx * zoom}px`,
                    position: 'relative',
                  }}
                  data-testid="canvas-preview-container"
                  className="transition-all duration-100 ease-out shrink-0"
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: `${project.canvas.widthPx * numSlides}px`,
                      height: `${project.canvas.heightPx}px`,
                      transform: `scale(${zoom})`,
                      transformOrigin: 'top left',
                    }}
                    className="shadow-2xl rounded overflow-hidden"
                  >
                    <BackgroundRenderer project={project} assets={assets} />
                    <OverlayRenderer project={project} />
                    <ContrastGuard project={project} assets={assets} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Right Inspector */}
        <RightInspector />
      </div>
    </div>
  );
};
