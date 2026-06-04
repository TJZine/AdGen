# Testing Strategy

This document details the test framework, execution scripts, and quality verification standards for the Template-to-Flyer Generator.

## Testing Architecture

We utilize a three-tiered testing strategy to ensure reliability:

1. **Unit Tests (Vitest)**: Fast, run in Node, checking pure utility modules and layout algorithms.
2. **Snapshot Tests (HTML/SVG)**: Ensures layout modifications produce stable, predictable output templates.
3. **Manual QA Checklist**: Steps for verifying complex UI drag actions, image crops, and final file compositing.

---

## 1. Unit Tests (Vitest)

Unit tests target modules under `lib/` and must run in isolation without requiring a browser or database connection.

### Core Scopes:

- **CSV Parser (`lib/utils/csv.ts`)**:
  - Parses standard strings containing headings: `section`, `title`, `subtitle`, `price`, `sale_price`, `badge`, `image`, `priority`, `tags`.
  - Gracefully handles empty fields, malformed lines, and quoted commas.

- **Price Formatter (`src/lib/utils/formatters.ts` - `formatCurrency`)**:
  - Formats numbers to standard currency (e.g. `530` -> `$530`).
  - Supports decimal rendering (e.g. `49.99` -> `$49.99`).
  - Supports text values / overrides.

- **Layout Engine Solver (`lib/layout/solver.ts`)**:
  - Validates that columns choose correctly based on density.
  - Ensures a layout tree returns complete coordinates (X, Y, W, H) for all cards and text components.
  - Verifies that locking elements prevents the solver from moving them.

- **Text Fitting & Overflow (`lib/layout/textFit.ts`)**:
  - Estimates font sizing using character lengths.
  - Returns positive overflow flags when text exceeds dimensions.

- **Validation Rules (`lib/validation/rules.ts`)**:
  - Asserts warnings when:
    - Text size falls below `10px`.
    - Required price field is empty.
    - Disclaimer text is missing.
    - Overall item count exceeds page boundaries.

---

## 2. Layout Snapshot Tests

We maintain standard mock projects to generate inline SVG/HTML strings. These strings are compared to baseline text files (`__snapshots__`) to verify changes do not cause unintended layout regression.

### Golden Test Cases:

1. **Single Item**: Assures hero-only scaling.
2. **Featured Row (3 Items)**: Verifies row layout column scaling.
3. **Catalog Setup (12 Items)**: Verifies sections display header spacing correctly.
4. **Dense Inventory Board (24 Items)**: Verifies section grids wrap columns properly.
5. **Overcrowded Layout (35 Items)**: Verifies text overflow and size warning triggers.
6. **Failsafe Rendering**: Verifies empty name fields render fallback placeholders and do not crash the engine.

---

## 3. Visual Regression Tests

Using Playwright test runner, we capture rendered outputs from the Next.js preview endpoint and compare screenshots against golden baselines:

- Command: `npx playwright test`
- Validates: Layout dimensions match aspect-ratio preset, overlays align precisely over backgrounds.

---

## 4. Manual QA Checklist

Prior to production releases, verify the following core interactions:

- **CSV Import**:
  - Load the reference handgun CSV. Verify all categories and descriptions populate.
- **Asset Upload**:
  - Upload a JPG product photo. Crop it, change fit mode to `contain`, and inspect the Canvas rendering.
- **Handoff Generation**:
  - Click "Export for AI Polish". Verify the generated ZIP contains a legible prompt, background-only image, and text overlay SVG.
- **Compositing**:
  - Import a styled background image. Toggle off the layout skeleton and overlay the text layer. Verify text contrast is readable.
