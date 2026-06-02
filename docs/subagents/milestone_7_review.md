# Milestone 7 (Exact Overlay Export) - Code Review & Verification Report

This report evaluates the implementation of Milestone 7 (Exact Overlay Export) in the workspace. It includes an analysis of type safety, lint compliance, unit tests, Next.js build compilation, overlay rendering logic (both PNG and SVG), and API validation.

---

## 1. Executive Summary

We performed a comprehensive review of the exact overlay export code and validated it using the project's verification suite.

* **Validation Status:**
  - `npm run typecheck` — **PASSED** (0 compilation errors)
  - `npm run lint` — **PASSED** (0 style or lint errors)
  - `npm run test` — **PASSED** (All 53 tests passed, including all 7 tests in `overlay.test.ts`)
  - `npm run build` — **PASSED** (Next.js production build succeeded with Turbopack)
* **Code Architecture:** The overlay export system provides two formats:
  - **PNG Overlay:** Runs headless Chromium via Playwright, navigates to the `/render-canvas` canvas preview route with `mode=overlay`, and takes an element screenshot with `omitBackground: true` to generate a high-fidelity transparent PNG.
  - **SVG Overlay:** Generates vector SVG text layouts purely on the server side using the layout solver (`solveLayout`) and text fitting engine (`fitText`). It mirrors HTML/CSS layout (vertical flex centering, text alignment, and line height) to generate a pixel-perfect overlay without browser overhead.
* **Overall Assessment:** The code is high-quality, type-safe, and passes all tests. The implementation correctly implements exact alignments, escaping rules, caching headers, and HTTP status code mappings.

---

## 2. File-by-File Detailed Inspection

### 2.1 `src/lib/export/renderService.ts`
Manages the server-side rendering of PNGs and SVGs.
* **`renderLayoutOverlayPng`:**
  - Correctly fetches the project canvas dimensions from the database.
  - Launches headless Playwright Chromium to navigate to `/render-canvas?id=${projectId}&mode=overlay`.
  - Captures the exact element locator `[data-testid="canvas-preview-container"]`.
  - Applies `{ type: 'png', omitBackground: true }` to ensure the captured image contains only text elements over a transparent background.
* **`renderLayoutOverlaySvg`:**
  - Resolves dynamic element layout on the server using `solveLayout(project)`.
  - Filters out all non-text layout elements to isolate text layers (`text`, `price`, `badge`, `footer`, `section_header`).
  - Matches CSS rendering rules exactly by computing the total height of fitted lines (`totalTextHeight = lines * fontSize * 1.2`) and calculating the vertical baseline offset (`startY = el.y + (el.height - totalTextHeight) / 2 + fontSize * 0.8`).
  - Correctly aligns text anchors (`left` => `start`, `center` => `middle`, `right` => `end`) and adjusts `x` coordinates to position elements properly.
  - Escapes SVG text content via `escapeSvg` to prevent syntax injection or invalid XML structures.

### 2.2 `src/app/api/export/overlay/route.ts`
GET API route that serves overlay requests.
* **Parameter Validation:** Validates `id` (required parameter) and `format` (must be either `'png'` or `'svg'`). Returns a standard `400 Bad Request` if parameters are invalid.
* **Content Types & Headers:**
  - PNG output returns a `NextResponse` wrapping a binary `Uint8Array` buffer with content-type `image/png` and explicit `Content-Length`.
  - SVG output returns the SVG XML string with content-type `image/svg+xml`.
  - Both formats specify `Cache-Control: no-store, must-revalidate` to avoid browser caching of stale canvas layouts.
* **Error Handling:** Gracefully handles database misses. Error messages containing `"not found"` map to `404 Not Found`, while other exceptions (such as Playwright navigation timeout) return `500 Internal Server Error`.

### 2.3 `src/test/overlay.test.ts`
Verifies the overlay API route and the SVG rendering logic.
* **API Mocking:** Mocks both database and Playwright instances to ensure unit tests execute rapidly.
* **SVG Structure Verification:** Imports the actual rendering service (`renderLayoutOverlaySvg`) to verify the generation of valid SVG structures, checking `<svg>` wrapping attributes, correct SVG escaping (e.g. `Handguns &amp; Gear`), and inclusion of specific text elements.
* **Status Code Coverage:** Covers all HTTP status code returns: 400 (invalid parameters), 404 (project not found), 500 (internal rendering crashes), and 200 (successful PNG/SVG generation).

---

## 3. Specific Requirement Verification Checklist

| Requirement | Status | Details / Implementation Reference |
| :--- | :---: | :--- |
| Container Screenshot with Transparency | **VERIFIED** | Playwright screenshot method uses `omitBackground: true` on `[data-testid="canvas-preview-container"]`. |
| Layout Solver & Text Fitting in SVG | **VERIFIED** | Integrates `solveLayout` and `fitText` to calculate font sizes and wrap text dynamically. |
| Vertical & Baseline Alignment | **VERIFIED** | Uses `(el.height - totalTextHeight) / 2 + fontSize * 0.8` for vertical centering and `fontSize * 1.2` for spacing. |
| Text Anchor Mapping | **VERIFIED** | Maps `textAlign` values to `start`, `middle`, and `end` text anchors, adjusting the reference X-coordinate. |
| SVG Special Char Escaping | **VERIFIED** | Uses a custom `escapeSvg` function to escape `&`, `<`, `>`, `"`, and `'`. |
| API Param Verification | **VERIFIED** | Rejects requests with missing `id` or invalid formats (not `png`/`svg`) with status 400. |
| Stream Content Types | **VERIFIED** | Serves PNGs with `image/png` and SVGs with `image/svg+xml`. |
| Cache Control | **VERIFIED** | Returns `no-store, must-revalidate` to ensure real-time overlay generations. |
| Database Miss & Error Routing | **VERIFIED** | Returns 404 for project misses and 500 for runtime failures (logging details to stdout). |

---

## 4. Validation Command Outputs

### 4.1 Typechecking Output (`npm run typecheck`)
```
> ad-gen@0.1.0 typecheck
> tsc --noEmit
```

### 4.2 Linting Output (`npm run lint`)
```
> ad-gen@0.1.0 lint
> eslint
```

### 4.3 Test Runner Output (`npm run test`)
```
> ad-gen@0.1.0 test
> vitest run

 RUN  v4.1.8 C:/Software/AdGen

 ✓ src/test/sample.test.ts (1 test) 4ms
 ✓ src/test/textFit.test.ts (4 tests) 7ms
 ✓ src/test/export.test.ts (5 tests) 16ms
 ✓ src/test/solver.test.ts (9 tests) 19ms
 ✓ src/test/csv.test.ts (15 tests) 26ms
 ✓ src/test/package.test.ts (8 tests) 40ms
 ✓ src/test/renderer.test.tsx (4 tests) 92ms
 ✓ src/test/overlay.test.ts (7 tests) 1688ms
     ✓ programmatically generates correct SVG structure using the service  1672ms

 Test Files  8 passed (8)
      Tests  53 passed (53)
   Start at  09:00:12
   Duration  3.94s
```

### 4.4 Build Output (`npm run build`)
```
> ad-gen@0.1.0 build
> next build

▲ Next.js 16.2.7 (Turbopack)

  Creating an optimized production build ...
✓ Compiled successfully in 2.0s
  Running TypeScript ...
  Finished TypeScript in 2.8s ...
  Collecting page data using 9 workers ...
  Generating static pages using 9 workers (0/4) ...
✓ Generating static pages using 9 workers (4/4) in 545ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /api/export/overlay
├ ƒ /api/export/package
├ ƒ /api/export/render
└ ƒ /render-canvas

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

---

## 5. Conclusion

Milestone 7 (Exact Overlay Export) is cleanly designed, robust, and correctly aligned with the product's UX/rendering specifications. The SVG rendering calculations are mathematically aligned with HTML flexbox container positioning, and the Playwright PNG capture logic ensures background transparency is preserved.

The implementation is **approved and verified**.
