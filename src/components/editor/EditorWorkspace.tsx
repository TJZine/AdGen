"use client";

import React, { useEffect, useState } from 'react';
import { useEditorStore } from '@/lib/store/editorStore';
import { LeftSidebar } from './LeftSidebar';
import { RightInspector } from './RightInspector';
import { ContentTableMode } from './ContentTableMode';
import { BackgroundRenderer } from '../renderer/BackgroundRenderer';
import { OverlayRenderer } from '../renderer/OverlayRenderer';
import { ContrastGuard } from './ContrastGuard';
import { Project, Asset } from '@/lib/schemas/project';

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
  } = useEditorStore();

  const [mode, setMode] = useState<'content' | 'canvas'>('content');

  // Initialize store with initialProject and assets
  useEffect(() => {
    setProject(initialProject, initialAssets);
  }, [initialProject, initialAssets, setProject]);

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
          <div className="flex-1 overflow-auto bg-zinc-100 p-8 flex items-center justify-center">
            {/* Aspect ratio-locked canvas preview with absolute scaling */}
            <div
              style={{
                width: `${project.canvas.widthPx * zoom}px`,
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
                  width: `${project.canvas.widthPx}px`,
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
          </div>
        )}

        {/* Right Inspector */}
        <RightInspector />
      </div>
    </div>
  );
};
