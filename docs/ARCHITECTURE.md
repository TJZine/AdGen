# Architecture Plan

This document outlines the high-level software architecture, core modules, data flows, and technology choices for the Template-to-Flyer Generator.

## Architectural Overview

To ensure reproducibility, testability, and stability, the system divides responsibilities into clearly defined layers. The **deterministic layout engine** contains no UI or browser-dependent code, allowing it to be fully unit-tested in isolation.

```mermaid
graph TD
    subgraph Client (Web App)
      EditorUI[Editor React UI]
      State[Zustand State Store]
      Canvas[Canvas Component - SVG/HTML]
      LayoutEngine[Layout Engine - Pure TS]
      State --> EditorUI
      EditorUI --> Canvas
      LayoutEngine --> State
    end

    subgraph Server (Next.js API Routes / Node)
      AssetMgr[Asset Manager - Sharp]
      ExportMgr[Export Pipeline - Playwright]
      ZipPackager[ZIP Packager - Archiver]
      DB[(SQLite Database - Prisma)]
    end

    EditorUI -->|Upload Images / CSV| AssetMgr
    EditorUI -->|Trigger Handoff/Render| ExportMgr
    ExportMgr -->|Read Assets| AssetMgr
    ExportMgr -->|Generate ZIP| ZipPackager
    State -->|Persist Project| DB
```

---

## Core System Modules

### 1. Domain Model & Schemas

- Defines strict interfaces (as specified in `SCHEMA_PLAN.md`) for projects, brands, items, and layouts.
- Functions as the unified contract between client state, database persistence, and external ZIP exports.

### 2. Pure Deterministic Layout Engine

- **Input**: Canvas Dimensions, Item List, Brand Styles, Layout Family, Density Parameter.
- **Output**: Bounding boxes (X, Y, Width, Height) for all elements, layout score, overflow warnings.
- **Behavior**: Pure mathematical heuristic solver. No HTML rendering or DOM measurements are allowed here. Font sizes and text wrapping are estimated using character-count heuristics.

### 3. Rendering Pipeline

- **Canvas Renderer**: Uses standard React components to render HTML and inline SVG inside the editor. The layout coordinates from the engine are passed directly to style positions (`top`, `left`, `width`, `height`).
- **Overlay Renderer**: Generates a clean, transparent SVG or HTML representation containing _only_ the text overlays, logos, and vector assets.
- **Background-Only Renderer**: Generates a layout representation containing the layout shapes, section grid cards, and images, but with all user-facing text elements omitted (leaving blocks clear for AI styling).

### 4. Editor UI & State

- **State Store**: Managed via `Zustand` with full undo/redo middleware support.
- **Canvas Interactions**: Custom SVG-based selection layer. Users can drag section headers or cards to reorder (hooked up to `@dnd-kit`) or resize them.
- **Property Inspector**: Side panel to modify properties of selected elements (e.g. promoting card to hero, applying specific card styling).

### 5. Backend Services (Next.js Server Actions / API Routes)

- **Asset Manager**: Receives image uploads, utilizes `sharp` to crop according to focal points and create standard thumbnails.
- **Export Pipeline**: Launches a headless browser instance (`playwright`) to load the HTML/SVG representation of the flyer at native print resolutions, then captures it as a high-quality PNG or PDF.
- **ZIP Packager**: Combines the prompt files, JSON definitions, asset folders, and rendered images into a single structured ZIP file for the user.

---

## Unified Execution Flow

### Phase A: Content Setup & Initial Layout

1. User enters text or uploads a CSV file.
2. The **Content Manager** saves the data to the Zustand store.
3. The **Layout Engine** runs, producing coordinates.
4. The **Canvas Renderer** displays the cards on screen.

### Phase B: Exporting for AI Handoff

1. The user requests an AI Handoff ZIP.
2. The backend generates:
   - Visual structure (`rough-layout.png`).
   - Clean background structure (`rough-layout-background-only.png`).
   - Text overlay (`exact-text-overlay.svg`).
   - Copy prompts (`prompt.md`, `negative-prompt.txt`).
3. The server bundles these into a ZIP.

### Phase C: Re-compositing AI Output

1. The user uploads the polished image back to the editor.
2. The app sets this image as the editor's background layer.
3. The **Overlay Renderer** places the exact text overlay on top.
4. User validates text readability (contrast checks, font choices) and exports the final print composite.
