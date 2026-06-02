# Milestone 5 (Rough Layout Export) - Code Review & Verification Report

This report evaluates the implementation of Milestone 5 (Rough Layout Export) in the workspace. It includes an analysis of code quality, rendering stability, resource leaks, edge cases, validation results, and verification of bug fixes.

---

## 1. Executive Summary

We performed a comprehensive review of the code, verified the implementation of the recommended fixes, and ran standard validations on the project. 

* **Validation Status:**
  - `npm run typecheck` — **PASSED** (0 compilation errors)
  - `npm run lint` — **PASSED** (0 style or formatting errors)
  - `npm run test` — **PASSED** (38/38 tests passed, including new route tests verifying 404 error mapping)
  - `npm run build` — **PASSED** (Next.js production build succeeded with static/dynamic route generation)
* **Code Architecture:** The rendering pipeline correctly fetches project content from SQLite, runs the layout solver on the server to position elements, and leverages headless Chromium (via Playwright) to capture layout screenshots.
* **Key Findings & Verification:**
  - **No Browser Leakage:** Verified. The browser resource cleanup (`browser.close()`) is correctly placed within a `finally` block, ensuring no Chromium zombies are created under success or failure paths.
  - **Viewport Dimensions / Edge Case (RESOLVED):** Verified. The screenshotting logic in `renderService.ts` has been updated to target the specific locator `[data-testid="canvas-preview-container"]` instead of using `fullPage: true`, ensuring precise PNG dimensions.
  - **Font Loading Race Condition (RESOLVED):** Verified. The service now waits for `document.fonts.ready` before taking screenshots, preventing fallback font rendering.
  - **Incorrect Status Codes (RESOLVED):** Verified. The API route in `route.ts` maps "not found" database errors to a `404 Not Found` response. A new unit test has been added to verify this mapping and passes successfully.

---

## 2. File-by-File Detailed Inspection

### 2.1 `src/app/render-canvas/page.tsx`
This route acts as the clean rendering canvas target for Playwright.
- **Project Fetching:** Correctly reads the project UUID from the promise `searchParams`, queries Prisma, parses the `contentJson` string, and validates it against `ProjectSchema` via Zod's `safeParse`.
- **Layout Solver:** Correctly invokes `solveLayout(project)` to calculate dynamic layout coordinates, and feeds the resulting `solvedProject` down to the renderer.
- **Viewport & Styling:** Effectively suppresses scrollbars and margins using:
  ```css
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    overflow: hidden !important;
    background-color: transparent !important;
  }
  ```
  And sets the root wrapper `div` width and height exactly to the project's canvas dimensions (`widthPx` and `heightPx`).

### 2.2 `src/lib/export/renderService.ts`
Manages Playwright browser instances and takes screenshots.
- **Resource Management:** Robust. The code wraps page navigation and screenshotting in a `try/finally` block. `await browser.close()` is placed in `finally` to ensure clean shutdown.
- **Font Wait & Element Capture:** Updated. The screenshot process waits for `document.fonts.ready` before capturing, and performs the screenshot on `page.locator('[data-testid="canvas-preview-container"]')` rather than page-wide.
- **Performance Trade-Off:** Starting and stopping a Chromium browser on *every* request is slow (adding ~500ms to 1.5s overhead). For low-concurrency pipelines, this is clean and prevents cross-request state leakage, but for high-throughput production workloads, reusing a single browser instance with dedicated contexts is recommended.

### 2.3 `src/app/api/export/render/route.ts`
Defines the GET endpoint for exporting the PNG image.
- **Input Validation:** Correctly verifies that `id` is present and that `mode` is either `full` or `background_only` (returning `400 Bad Request` if invalid).
- **Streaming & Headers:** Converts the binary buffer to a `Uint8Array` inside `NextResponse` and correctly applies:
  - `Content-Type: image/png`
  - `Content-Length: <size>`
  - `Cache-Control: no-store, must-revalidate` (critical to prevent browser cache from serving stale renders).
- **Graceful Error Mapping:** Catches errors from `renderService.ts` and inspects the error message. If it detects `not found` (case-insensitive), it responds with `404 Not Found` instead of `500 Internal Server Error`.

### 2.4 `src/test/export.test.ts`
Tests the route endpoint.
- **Coverage:** Correctly mocks the render service using Vitest. Verifies:
  - `400` status when project ID is missing.
  - `400` status when mode parameter is invalid.
  - `200` status and appropriate headers when successful.
  - `500` status when the underlying render service throws an error (e.g. Playwright timeout).
  - `404` status when the project is not found in the database (verified with a new test case).

---

## 3. Verification of Rendering Stability & Edge Cases

### A. Viewport and Screenshot Precision
Previously, the screenshot used `{ fullPage: true }`, which could yield a PNG larger than `widthPx` x `heightPx` if any subpixel overflow occurred.
* **Fix Applied & Verified:** The code now targets `[data-testid="canvas-preview-container"]` directly:
  ```typescript
  const pngBuffer = await page.locator('[data-testid="canvas-preview-container"]').screenshot({
    type: 'png',
  });
  ```
  This guarantees that the returned screenshot has the exact canvas dimensions.

### B. Font Loading Race Condition
Previously, screenshotting happened as soon as the network was idle, which did not guarantee that web fonts were fully loaded.
* **Fix Applied & Verified:** The code now awaits:
  ```typescript
  await page.evaluate(() => document.fonts.ready);
  ```
  This blocks screenshot capture until all CSS-connected fonts are ready, ensuring correct rendering of typography.

### C. Client Error vs. Server Error (HTTP Status Codes)
Previously, a database lookup failure resulted in a generic `500 Internal Server Error`.
* **Fix Applied & Verified:** The route controller has been updated to scan error messages for `"not found"` (case-insensitive) and return status code `404` with the appropriate error details. A unit test verifying this behavior has been added and runs successfully.

---

## 4. Implemented Code Diffs

The fixes match the recommended improvements perfectly. Here is the verified implementation in the workspace:

### Code in `src/lib/export/renderService.ts`

```typescript
    // 5. Navigate to rendering route and wait until network is idle
    await page.goto(url, {
      waitUntil: 'networkidle',
    });

    // Wait for web fonts to load
    await page.evaluate(() => document.fonts.ready);

    // 6. Ensure the main canvas is visible
    await page.waitForSelector('[data-testid="canvas-preview-container"]', {
      state: 'visible',
      timeout: 10000,
    });

    // 7. Take PNG screenshot of the canvas element specifically
    const pngBuffer = await page.locator('[data-testid="canvas-preview-container"]').screenshot({
      type: 'png',
    });
```

### Code in `src/app/api/export/render/route.ts`

```typescript
  } catch (error) {
    console.error('Error rendering layout PNG:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Internal Server Error';

    if (errorMessage.toLowerCase().includes('not found')) {
      return NextResponse.json(
        { error: errorMessage },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
```

---

## 5. Conclusion

Milestone 5 is fully implemented, verified, and stable. All standard validations (`typecheck`, `lint`, `test`, `build`) pass cleanly without warnings or errors. The additions to screenshot targeting, font loading synchronization, and API status mapping resolve the critical concerns and stabilize the rendering output for production.
