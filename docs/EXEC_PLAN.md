# Execution Plan

This document establishes the roadmap for building the Template-to-Flyer Generator, starting from project initialization to final overlay capabilities, integrated with quality gates and testing requirements.

## Phase 0: Discovery & Setup (Current Phase)

- **Objective**: Establish codebase parameters, schemas, and directory layout.
- **Deliverables**:
  - Authoritative planning documents in `docs/` (including subagent reviews and synthesized plan).
  - Base project dependencies and directory setup.
- **Acceptance Criteria**:
  - Plans reviewed and approved by the User.
  - Development sandbox verified.

---

## Phase 1: Base Setup, Content Model & Static Renderer

- **Objective**: Set up data storage (SQLite/Prisma), define core Zod models, and implement a static renderer that displays structured content from JSON coordinates.
- **Deliverables**:
  - Next.js workspace setup with Tailwind CSS and TypeScript.
  - SQLite database schema configured with Prisma ORM (`prisma/schema.prisma`).
  - Core schema models (`Asset`, `Template`, `CanvasPreset`, `BrandProfile`, `Section`, `Item`, `LayoutElement`).
  - Seed script with the "CFC Tactical" handgun inventory board data.
  - CSV and Clipboard input parser utilities (`src/lib/utils/csv.ts`).
  - Static canvas renderer rendering a basic HTML/SVG view of the board from JSON.
- **Quality Gate**:
  - Database schema passes `npx prisma validate`.
  - The seed script successfully loads the sample handgun inventory dataset.
  - TypeScript compilation completes with zero errors (`npm run typecheck`).
  - Unit tests verify parser utility and currency formatting logic.

---

## Phase 2: Heuristic Layout Engine (HGP) & Validation Rules

- **Objective**: Develop the pure mathematical engine that calculates element bounds using Hierarchical Grid Partitioning (HGP), handles text fitting/line wrap, and scores layout options.
- **Deliverables**:
  - Pure layout functions under `src/lib/layout/` (specifically `solver.ts` executing canvas margins partitioning and section height budgeting).
  - String wrap and scale text utility (`src/lib/layout/textFit.ts`).
  - Real-time warning check rules (`src/lib/validation/rules.ts`) for tiny text (<10px), low contrast, overcrowding, and missing CTA.
  - Layout scoring engine assessing overflows, whitespace balance, and item density.
- **Quality Gate**:
  - Vitest unit tests pass for layout engine solver and text fitting.
  - Snapshot tests verify bounding box coordinates for 1, 6, 12, and 24 items.
  - Validation engine test coverage is >90%.
  - Zero TypeScript `any` types permitted in layout interfaces.

---

## Phase 3: Content Organizer & Dual-Mode UI

- **Objective**: Create the interactive panels allowing users to manipulate sections, items, and card details using a dual-mode workspace view.
- **Deliverables**:
  - Zustand state manager with history middleware (undo/redo).
  - Mode A: Content Table with drag-and-drop item and section ordering (`@dnd-kit`).
  - Mode B: Layout Canvas View with Left Sidebar (presets/scoring/warnings) and Right Properties Inspector (focal crops, priority toggles).
  - Variant Picker rendering thumbnails of alternative engine layouts.
- **Quality Gate**:
  - UI component tests verify drag-and-drop triggers coordinate updates in Zustand.
  - Undo/redo history stack is verified to correctly restore state on canvas.
  - Visual regression testing passes under Playwright for standard presets (Letter, Poster, Instagram).

---

## Phase 4: Exporter ZIP & AI Handoff

- **Objective**: Generate target prompt instructions and render exact visual packages for ZIP download.
- **Deliverables**:
  - Prompt compiler generating custom prompts and text-suppressing negative prompts (`src/lib/export/promptBuilder.ts`).
  - Next.js API route using Playwright to render high-res files:
    1. Complete rough layout reference (`rough-layout.png`).
    2. Background-only reference without text paths (`rough-layout-background-only.png`).
    3. Transparent text overlay (`exact-text-overlay.svg` / `exact-text-overlay.png`).
  - ZIP packager compiling prompt markdowns, JSON schema dumps, and cropped assets (`src/lib/export/zipPackager.ts`).
- **Quality Gate**:
  - ZIP file structure assertions pass (checking manifest, README, prompts, renders, and assets).
  - Playwright rendering produces exact pixel dimensions matching target DPI.

---

## Phase 5: Polished Image Import & Final Composite

- **Objective**: Implement the overlay compositing layer where the polished AI background is combined with clean text and vector elements, validating readability and contrast.
- **Deliverables**:
  - Upload interface supporting security validation (EXIF metadata stripping, magic-bytes checks).
  - Background fit engine (Cover, Contain, Stretch fit modes) and manual translation offsets (global and section X/Y nudging).
  - Contrast Guard warning engine (sampling luminance and evaluating WCAG AA contrast compliance).
  - Legibility enhancement presets (backing plates, drop shadows, outlines).
  - Final composite export of print-ready vector PDF and PNG.
- **Quality Gate**:
  - Upload security validator blocks non-image magic-number files.
  - Contrast calculations successfully trigger editor warnings under low-contrast conditions.
  - PDF export renders sharp vector text paths (tested via Playwright).
  - End-to-end integration test successfully generates and exports the handgun flyer.
