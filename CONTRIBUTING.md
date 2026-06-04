# Contributing to AdGen

Thank you for your interest in contributing to AdGen. This document covers the development workflow, coding standards, and project conventions.

---

## Table of Contents

- [Development Setup](#development-setup)
- [Project Conventions](#project-conventions)
- [Code Style](#code-style)
- [Branch Strategy](#branch-strategy)
- [Testing Requirements](#testing-requirements)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)
- [Architecture Guidelines](#architecture-guidelines)

---

## Development Setup

### Prerequisites

- **Node.js** 18.17+ 
- **npm** 9+
- **Git**

### First-Time Setup

```bash
# Clone the repository
git clone <repository-url> AdGen
cd AdGen

# Install dependencies
npm install

# Set up the database
npx prisma migrate dev
npx prisma db seed

# Start the development server
npm run dev
```

### Verifying Your Setup

After starting the dev server, confirm everything works:

```bash
# Run type checks
npm run typecheck

# Run unit tests
npm run test

# Run linting
npm run lint
```

---

## Project Conventions

### Directory Structure

| Directory | Purpose | Rules |
|---|---|---|
| `src/lib/` | Pure business logic | No React, no DOM, no browser APIs. Must be testable under Node. |
| `src/lib/layout/` | Layout engine | Pure TypeScript. No HTML rendering or DOM measurements. |
| `src/lib/schemas/` | Zod schemas | Domain type definitions and validation. Single source of truth. |
| `src/lib/utils/` | Utility functions | Stateless helper functions. |
| `src/lib/export/` | Export pipeline | Server-side rendering and packaging. |
| `src/lib/store/` | Zustand stores | Client-side state management. |
| `src/components/` | React components | UI components, organized by feature. |
| `src/app/` | Next.js routes | Page components and API routes. |
| `src/test/` | Test files | Unit and component tests. |
| `e2e/` | E2E tests | Playwright browser tests. |
| `docs/` | Documentation | Architecture, decisions, guides. |
| `prisma/` | Database | Schema, migrations, seed data. |

### Import Aliases

Use the `@/` alias for imports from `src/`:

```typescript
// ✅ Correct
import { ProjectSchema } from '@/lib/schemas/project';
import { EditorWorkspace } from '@/components/editor/EditorWorkspace';

// ❌ Incorrect
import { ProjectSchema } from '../../../lib/schemas/project';
```

### File Naming

- **Components:** PascalCase (e.g., `EditorWorkspace.tsx`, `LeftSidebar.tsx`)
- **Utilities & modules:** camelCase (e.g., `solver.ts`, `formatters.ts`, `csvParser.ts`)
- **Test files:** Match source file name with `.test.ts` or `.test.tsx` suffix
- **API routes:** `route.ts` inside the appropriate directory

---

## Code Style

### TypeScript

- **Strict mode is enabled.** All code must pass `tsc --noEmit` without errors.
- Use explicit types for function parameters and return values on exported functions.
- Prefer `interface` for object shapes, `type` for unions and intersections.
- Use Zod schemas as the canonical type source for domain objects, with `z.infer<>` for TypeScript types.

### Formatting

Code is formatted with **Prettier** using the project's `.prettierrc` configuration. Format before committing:

```bash
npm run format
```

### Linting

ESLint is configured with the Next.js recommended ruleset plus Prettier integration:

```bash
npm run lint
```

### React Components

- Use **function components** exclusively.
- Server Components are the default in Next.js App Router; add `'use client'` only when client-side interactivity is required.
- Keep components focused: one primary responsibility per component.
- Extract reusable logic into custom hooks in `src/lib/` or co-located `hooks/` directories.

---

## Branch Strategy

| Branch | Purpose |
|---|---|
| `main` | Stable, production-ready code |
| `feature/<name>` | New features and enhancements |
| `fix/<name>` | Bug fixes |
| `docs/<name>` | Documentation updates |

### Workflow

1. Create a feature branch from `main`.
2. Make your changes with clear, incremental commits.
3. Ensure all tests pass and types check.
4. Open a pull request with a description of your changes.

---

## Testing Requirements

All changes must maintain or improve test coverage. See [docs/TESTING_STRATEGY.md](docs/TESTING_STRATEGY.md) for detailed testing guidelines.

### Before Submitting

Run the full verification suite:

```bash
# Type safety
npm run typecheck

# Unit tests
npm run test

# Linting
npm run lint

# E2E tests (requires dev server running)
npm run test:e2e
```

### Test Placement

- **Unit tests:** `src/test/<module-name>.test.ts`
- **Component tests:** `src/test/<component-name>.test.tsx`
- **E2E tests:** `e2e/<feature>.spec.ts`

### What to Test

| Module | Test Focus |
|---|---|
| Layout engine (`lib/layout/`) | Coordinate output, overflow detection, density scaling, edge cases |
| Schemas (`lib/schemas/`) | Validation rules, Zod `.catch()` defaults, migration pipeline |
| CSV parser (`lib/utils/csv.ts`) | Quoted fields, empty values, malformed lines |
| Validation rules (`lib/validation/`) | Warning thresholds, edge cases |
| Components | Render output, user interactions, state changes |
| API routes | Request validation, auth, error handling |

### Layout Engine Tests

The layout engine is a pure mathematical solver. Tests must verify:

- Correct bounding boxes (X, Y, width, height) for all elements
- Proper column selection based on item count and density
- Overflow detection triggers at correct thresholds
- Hero items receive priority sizing
- Locked elements are not moved by the solver

---

## Commit Messages

Use clear, descriptive commit messages:

```
<type>: <short description>

<optional longer description>
```

### Types

| Type | Usage |
|---|---|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `refactor` | Code restructuring without behavior change |
| `docs` | Documentation only |
| `test` | Adding or updating tests |
| `style` | Formatting, whitespace, missing semicolons |
| `chore` | Build config, dependencies, tooling |

### Examples

```
feat: add density slider to layout sidebar
fix: correct text overflow detection for long product names
docs: add API reference documentation
test: add solver tests for 30+ item layouts
refactor: extract card sizing logic into utility function
```

---

## Pull Request Process

1. **Title:** Clear, concise description of the change.
2. **Description:** Include:
   - What the change does and why
   - Any design decisions or trade-offs
   - Screenshots for UI changes
3. **Checklist:**
   - [ ] `npm run typecheck` passes
   - [ ] `npm run test` passes
   - [ ] `npm run lint` passes
   - [ ] New features include tests
   - [ ] Documentation is updated if needed
4. **Review:** All PRs require at least one review before merging.

---

## Architecture Guidelines

### Key Principles

1. **Separation of concerns.** The layout engine (`lib/layout/`) must remain pure TypeScript with no browser dependencies. This allows it to be unit-tested under Node without a browser environment.

2. **Content truth vs. visual styling.** Never rely on AI or external services for rendering exact text, prices, or contact information. These are deterministically generated by the app.

3. **Compiler first, editor second.** AdGen's primary value is structured content → deterministic layout → AI-ready export. The visual editor is a convenience layer, not the core product.

4. **Zod schemas are the contract.** All domain objects flow through Zod validation. Schema changes must include migration support for older project files.

5. **Deterministic rendering.** Given the same input data, the layout engine and renderer must produce identical output every time. No randomness in layout computation.

### Adding a New Layout Family

1. Define the layout configuration in `src/lib/schemas/project.ts`.
2. Add solver logic in `src/lib/layout/solver.ts`.
3. Add snapshot tests for various item counts (1, 3, 6, 12, 20, 30+).
4. Add the family to the layout picker in `src/components/editor/LeftSidebar.tsx`.
5. Update documentation.

### Adding a New Export Format

1. Implement the renderer in `src/lib/export/renderService.ts`.
2. Create the API route under `src/app/api/export/<format>/route.ts`.
3. Add auth and rate limiting (follow existing patterns).
4. Add tests in `src/test/`.
5. Update the API reference in `docs/API_REFERENCE.md`.

### Adding a New Validation Rule

1. Add the rule in `src/lib/validation/rules.ts`.
2. Define thresholds and warning messages.
3. Add unit tests.
4. The editor automatically picks up new warnings from the validation engine.

---

## Questions?

If you're unsure about anything, open a discussion or check the existing documentation:

- [Architecture](docs/ARCHITECTURE.md) — System design and module responsibilities
- [Design Decisions](docs/DECISIONS.md) — Rationale behind key technical choices
- [Testing Strategy](docs/TESTING_STRATEGY.md) — Test framework and methodology
- [API Reference](docs/API_REFERENCE.md) — REST API documentation
- [Usage Guide](docs/USAGE_GUIDE.md) — End-user workflow guide
