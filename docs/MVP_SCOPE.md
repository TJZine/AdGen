# MVP Scope

This document defines the functional boundaries of the Minimum Viable Product (MVP) for the Template-to-Flyer Generator.

## Functional Scope

### In-Scope for MVP

1. **Project Management**:
   - Create, duplicate, delete, and save projects.
   - Canvas presets (Letter Flyer 8.5x11, Poster 11x17, Instagram Square/Portrait, Facebook Post, Web Banner, Custom).
   - Export and import project as a single JSON file.

2. **Content Organization**:
   - Section creation and ordering.
   - Item details: name, subtitle, description, price, sale price, badge text, image, priority (hero vs. normal), tags.
   - Table/grid content editor with drag-and-drop ordering (using `@dnd-kit`).
   - Import content from CSV and spreadsheet clipboard pastes.

3. **Brand Profile**:
   - Reusable brand profiles (Logo asset, colors, website/contact info, style keywords, font choices).
   - Default disclaimers and footer blocks (critical for compliance).

4. **Deterministic Layout Engine**:
   - Heuristic layout generator using deterministic math (not AI).
   - Supports 3 layout families:
     - **Inventory Board**: Grouped section grids, readable lists, optional hero card.
     - **Hero + Grid Flyer**: Single prominent hero card, supporting grid of smaller cards.
     - **Menu/Listing Board**: Text-heavy items, small thumbnails, structured price alignments.
   - Dynamic adaptation based on content count (e.g., auto column and size adjustments).
   - Generation of at least 3 distinct layout variants per content setup.
   - Bounding-box and coordinate output (Layout JSON).

5. **Visual Layout Editor**:
   - Center canvas visual preview.
   - Structural adjustments: drag cards to swap position/sections, resize cards within grid parameters.
   - Property inspector side panels for selected elements.
   - Undo/redo state management (`zustand` with middleware).

6. **Validation and Warning System**:
   - Real-time warnings:
     - Text overflow (content exceeds card dimensions).
     - Tiny text (font sizes below 10px / 8pt threshold).
     - Too many items (overcrowding the canvas).
     - Low image resolution.
     - Missing required fields (price, contact info, legal disclaimer).
     - Unused (hidden) items.

7. **AI Handoff Generation & Package Export**:
   - Automation of prompting: generates custom layout prompts and negative prompts.
   - ZIP Handoff package export containing:
     - `README.md` instruction file.
     - `prompt.md` (detailed visual layout directions).
     - `negative-prompt.txt`.
     - `rough-layout.png` (visual structure).
     - `rough-layout-background-only.png` (background-only structure for background polish mode).
     - `exact-text-overlay.svg` / `exact-text-overlay.png` (transparents).
     - `project.json` / `content.json` / `layout.json` / `brand.json` schemas.
     - Cropped asset images.

8. **Compositing and Final Export**:
   - Import polished AI-generated background.
   - Deterministic alignment and re-layering of text, prices, logos, QR codes.
   - Export final high-resolution composite PNG/PDF.

---

### Out of Scope (Deferred to Post-MVP)

1. **Freeform Canvas Editor**:
   - No generic canvas tool (no drawing vectors, arbitrary shape creation, complex canvas layering).
2. **Direct AI Image Generation API**:
   - No direct billing/API key integration for Midjourney/DALL-E in the editor; the focus is on a structured handoff ZIP.
3. **Multi-page Catalogs**:
   - Restricted to single-page flyers/boards (social carousels will treat each page as a separate canvas but multi-page document compiles are deferred).
4. **Cloud / Collaboration / Authentication**:
   - Local-first application. No databases except local SQLite / IndexedDB. No user accounts or sharing links.
5. **Background Removal & Advanced Image Filters**:
   - Basic cropping and focal-point sizing only.
