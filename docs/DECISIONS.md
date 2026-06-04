# Design Decisions

This document records the architectural and product decisions governing the Template-to-Flyer Generator (AdGen), along with their rationales and trade-offs.

## Architectural Decisions

### 1. Unified Web Stack (Next.js + TypeScript)

- **Decision**: Build the application using Next.js (App Router), TypeScript, and Tailwind CSS.
- **Rationale**: Next.js combines React client-side interfaces with Node.js server routes. This allows us to use `sharp` (for image processing) and `playwright` (for high-res rendering) in the same codebase without needing a separate backend service.
- **Trade-off**: Slightly higher initial boilerplate than a simple Vite bundle, but drastically simplifies deployment and export API orchestration.

### 2. SQLite Database with Prisma ORM & Hybrid JSON Mapping

- **Decision**: Use a local SQLite database file backed by Prisma for schema management, but serialize sections, items, and coordinate results inside a single JSON string column (`contentJson`) rather than strict relational tables.
- **Rationale**: SQLite is reliable, fast, and requires zero configuration for self-hosting. By storing volatile layout configurations inside a serialized JSON string, we avoid database migration locks as the layout solver and card attributes undergo rapid iteration.
- **Trade-off**: Limits SQL query capability on sub-items (e.g. searching for specific item price bounds directly in database), but search query requirements are lightweight for a single-user local compiler.

### 3. Zod Tolerant Schema Validation & Code Migrations

- **Decision**: Validate domain structures using Zod. Use `.catch()` and `.default()` fallback definitions, and route imported files through a sequential code-based migration pipeline (`migrations.ts`) mapped to a project `schemaVersion` tag.
- **Rationale**: Prevents client-side crashes when users import older project files or templates as layout parameters or schema attributes change.
- **Trade-off**: Requires maintaining a migration script mapped to every schema version increment.

### 4. Headless Playwright Export Engine

- **Decision**: Use server-side headless browser capture via Playwright for raster PNG screenshots and print vector PDF exports.
- **Rationale**: Playwright renders CSS layouts, custom fonts, and vector SVG overlays perfectly matching what the client browser displays. The PDF export keeps text paths as selectable vectors.
- **Trade-off**: Resource-intensive cold-starts. Mitigated by setting a 15-second timeout, caching browser binaries, and utilizing base64 image inlining to remove network delays.

### 5. Multi-Tiered Test Stack (Vitest + Playwright)

- **Decision**: Divide testing into Vitest (fast statement execution, schema checks, and layout coordinate snapshots) and Playwright (visual regressions and E2E composite exports).
- **Rationale**: Ensures high confidence in deterministic coordinates and styling layout calculations without slowing down the test suite. Visual regression uses a `0.1%` pixel tolerance threshold to bypass subpixel rendering differences across platforms.

---

## Product & Layout Decisions

### 6. "AI Polish + Exact Overlay" Default Workflow

- **Decision**: The app splits layouts into styled background layers (polished by AI) and vector text overlays (rendered deterministically by the app).
- **Rationale**: Current AI generators (Midjourney, DALL-E, etc.) are highly capable of creating texture, lighting, and layout polish, but frequently hallucinate and corrupt text, prices, website addresses, and fine details. Splitting these elements guarantees commercial readability and absolute correctness.
- **Trade-off**: Requires a two-stage export/import process, but guarantees professional quality without spelling errors.

### 7. Core Layout Solver: Hierarchical Grid Partitioning (HGP)

- **Decision**: Implement a pure, browser-independent TypeScript solver utilizing hierarchical partitioning. It divides canvas space into margins, vertical blocks (header, footer, main), and allocates section grid coordinates proportionally using priority weights.
- **Rationale**: Guarantees fast, deterministic coordinates output. Separating mathematical placement from client-side DOM rendering allows layout runs to be tested directly under Node/Vitest.
- **Trade-off**: Does not support complex, multi-pass fluid-dynamics wrap solutions, but satisfies all MVP layout preset types (Inventory, Hero+Grid, Menu).

### 8. Text Masking for AI Handoff

- **Decision**: Generate `rough-layout-background-only.png` with all text strings omitted, replacing characters with solid gray container boxes. Include a strict negative prompt text file.
- **Rationale**: Eliminates "Double-Texting" / text ghosting where AI tries to redraw legible letters, leaving deformed visual artifacts behind the exact vector overlay.
- **Trade-off**: The AI tool does not see the exact text copy, but receives card structures and descriptive markdown instructions detailing contents.

### 9. Compiler First, Freeform Canvas Second

- **Decision**: Avoid building a Canva-like freeform canvas editor for the MVP. Layouts are computed dynamically using mathematical rules. The editor supports reordering, item properties, card sizes, and grid dimensions, but not arbitrary pixel placement.
- **Rationale**: Speed of execution. Re-ordering structured content is much faster than manually arranging 20 cards on a grid. Keep the layout system deterministic.
- **Trade-off**: Users cannot drag elements to arbitrary locations outside the grid structure, but this keeps layouts clean and prevents layout errors.

---

## Validation & Warning Thresholds

To keep flyers readable and prevent compliance errors, the following metrics are validated in real-time:

| Check                       | Threshold / Condition                                                                        | Action                                                            |
| --------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **Tiny Text**               | Font size falls below `10px` / `8pt` physical equivalent.                                    | Show Warning (Readability risk)                                   |
| **Text Overflow**           | Text bounding-box height exceeds container bounds.                                           | Show Warning (Truncation risk) & enforce ellipsis                 |
| **Overcrowding**            | Card count exceeds aspect-ratio density recommendations or card scales below `120px x 60px`. | Show Warning (Clutter risk) / switch layout                       |
| **Low Resolution**          | Uploaded image DPI falls below `150 DPI` at physical size.                                   | Show Warning (Blurry print risk)                                  |
| **Missing required fields** | Item is visible but lacks a title or price.                                                  | Show Warning (Incomplete data)                                    |
| **Legal/CTA missing**       | Project settings omit footer contact or default disclaimers.                                 | Show Warning (Compliance risk)                                    |
| **Low Contrast**            | Overlay text relative luminance contrast ratio $< 4.5:1$ (AA standards).                     | Show Warning (Readability risk) & suggest legibility enhancements |

---

## Security & Sanitization Decisions

### 10. Magic-Number & EXIF Verification

- **Decision**: Validate file uploads via magic bytes (using `file-type`) rather than filename extensions. Process all uploads through `Sharp` on the backend to sanitize file paths, rename to UUIDs, and strip EXIF/GPS metadata.
- **Rationale**: Mitigates Remote Code Execution (RCE) and Directory Traversal risks from malicious uploads. Stripping metadata safeguards user privacy.
