# Subagent Plan

This document establishes roles and task boundaries for subagents when building the Template-to-Flyer Generator. Splitting execution into focused components keeps main-thread context lean and maintains code quality.

## Subagent Definitions

We define specialized personas using the `self` subagent type (inheriting full workspace access).

### 1. Subagent: Layout Heuristic Developer

- **Role**: Backend/Compiler Developer.
- **Responsibilities**:
  - Implement pure TypeScript functions for the Layout Engine (`lib/layout/`).
  - Implement item-column allocation heuristics, margin calculations, and auto-sizing.
  - Implement validation checks (text overflow, text size warnings, and pricing details).
  - Write complete unit tests to verify the layout engine runs on arbitrary configurations.
- **Scope**: Layout logic, schemas, and tests. No React code or styling.

### 2. Subagent: Editor State & UI Developer

- **Role**: Frontend Developer.
- **Responsibilities**:
  - Build the React panels (left sidebar, right properties inspector, canvas wrapper).
  - Configure Zustand editor state (including history and undo/redo middleware).
  - Integrate `@dnd-kit` for drag-and-drop row/section reordering.
  - Bind layout coordinate outputs from the engine to absolute styles in the DOM canvas.
- **Scope**: Next.js client components, Zustand stores, styling.

### 3. Subagent: Asset Manager & ZIP Exporter

- **Role**: Backend Systems Engineer.
- **Responsibilities**:
  - Configure database persistence using Prisma & SQLite.
  - Write image upload API routes and integrate `sharp` for thumbnail generation and focal crops.
  - Implement the ZIP packager utility (`archiver`) to bundle prompt markdown files, JSON specifications, and visual assets.
- **Scope**: Prisma schemas, Next.js server actions, utility scripts.

### 4. Subagent: Playwright screenshot Exporter

- **Role**: DevOps / Integration Specialist.
- **Responsibilities**:
  - Set up Playwright configuration for Next.js backend API routes.
  - Create layout templates optimized for high-resolution screenshots.
  - Implement high-res PNG/PDF export endpoints.
  - Ensure local fonts render correctly inside the headless browser context.
- **Scope**: Headless browsers, PDF rendering, background compositing routes.

---

## Delegation Workflow

To ensure smooth alignment:

1. **Definition**: The orchestrator defines schemas (`docs/SCHEMA_PLAN.md`) and directory layouts first.
2. **Context**: Tasks are delegated by providing subagents with links to design docs and specific files.
3. **Feedback**: Subagents perform their code work, write appropriate tests, verify their outcomes, and report their changes back to the orchestrator.
4. **Integration**: The orchestrator reviews the files touched by subagents, performs final validation checks, and updates the task checklist.
