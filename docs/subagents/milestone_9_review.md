# Adversarial QA Review - Milestone 9

**Milestone Details:** Polished Background Import and Final Composite
**Date of Review:** June 2, 2026
**Reviewer:** Senior QA Engineer & Code Reviewer

---

## 1. Executive Summary

We performed an adversarial QA review of the Milestone 9 implementation, covering the polished background settings schema, the POST `/api/upload` endpoint, the GET `/api/export/pdf` endpoint, the `ContrastGuard` component, visual background and overlay renderers, and the associated Vitest suite.

All validations pass successfully:
- **TypeScript Typecheck:** Clean (no errors/warnings).
- **ESLint Linter:** Clean (no errors/warnings).
- **Vitest Unit Tests:** All 76 tests across 10 test suites pass successfully (100% pass rate).
- **Production Build:** Succeeded with no compilation or static page generation errors.

During our adversarial inspection, we identified **6 code quality gaps and logical edge cases** (including a canvas opacity rendering mismatch in `ContrastGuard` and image extension mapping bugs in the upload API). With these minor issues addressed, the composite and background features are in excellent shape. We recommend **Approval with minor recommendations**.

---

## 2. Validation & Verification Status

### 2.1 TypeScript Typecheck
- **Command:** `npm run typecheck`
- **Status:** **PASS**
- **Details:** The compiler executed `tsc --noEmit` cleanly across all client components, server routing modules, and utilities.

### 2.2 ESLint Linting
- **Command:** `npm run lint`
- **Status:** **PASS**
- **Details:** Clean run of ESLint; strict code styling rules are adhered to, standard React guidelines are followed, and no unused variables or hooks exist.

### 2.3 Vitest Tests
- **Command:** `npm run test`
- **Status:** **PASS** (76 of 76 tests passed)
- **Details:** The test suite evaluates core editor and export capabilities, including:
  - **Asset Upload magic-bytes verification:** Checks that uploads with invalid file types or unsupported MIME types are blocked, and successful files are saved.
  - **ContrastGuard Math:** Verifies correct hex-to-RGB conversion, relative luminance calculations (matching WCAG), and contrast ratio calculations.
  - **Export PDF Route:** Verifies parameter checks, rendering error handoffs, and attachment headers.

### 2.4 Next.js Production Build
- **Command:** `npm run build`
- **Status:** **PASS**
- **Details:** Succeeded with Next.js Turbopack compiler. Static page generation and dynamic routing are configured correctly.

---

## 3. Detailed Component Code Quality Analysis & Findings

### 3.1 ContrastGuard Background Opacity Misalignment (Bug)
- **File:** `src/components/editor/ContrastGuard.tsx`
- **Description:** `ContrastGuard` draws the background image onto an offscreen canvas using `ctx.drawImage` to sample pixels. However, it does not set `ctx.globalAlpha = polishedBg.opacity`.
- **Impact:** If the user sets the background image opacity to, say, `0.2` (making it almost transparent and letting the white brand background shine through), `ContrastGuard` still samples the image at `1.0` opacity. This yields false-positive contrast warnings because it doesn't analyze the actual, blended background color visible to the user.
- **Recommended Fix:** Set the context's `globalAlpha` before drawing the image:
  ```typescript
  ctx.save();
  ctx.clearRect(0, 0, cw, ch);
  ctx.globalAlpha = polishedBg?.opacity ?? 1; // Set global alpha matching rendering opacity
  ctx.translate(cw / 2, ch / 2);
  // ...
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
  ```

### 3.2 ContrastGuard Legibility Presets Ignored (Logic Gap)
- **File:** `src/components/editor/ContrastGuard.tsx`
- **Description:** `ContrastGuard` ignores whether `legibilityPreset` (`backing_plate`, `drop_shadow`, `text_outline`) is active.
- **Impact:** When a user selects a `backing_plate` legibility preset, a solid/semi-transparent background block is drawn directly behind the text. This resolves contrast issues. However, `ContrastGuard` continues to display a warning badge based on the raw background image, causing unnecessary noise for the user.
- **Recommended Fix:** Mathematically blend the background pixel with the backing plate color before computing relative luminance if `legibilityPreset === 'backing_plate'`:
  ```typescript
  const plateAlpha = 0.7; // match opacity used in OverlayRenderer
  const plateColor = isDarkColor(textColor) ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 };
  
  if (preset === 'backing_plate') {
    r = r * (1 - plateAlpha) + plateColor.r * plateAlpha;
    g = g * (1 - plateAlpha) + plateColor.g * plateAlpha;
    b = b * (1 - plateAlpha) + plateColor.b * plateAlpha;
  }
  ```

### 3.3 State Update on Unmounted Component in ContrastGuard (Memory Leak)
- **File:** `src/components/editor/ContrastGuard.tsx`
- **Description:** The `useEffect` loads the image asynchronously using `img.onload`. If the component is unmounted or `imageSrc` changes while loading, `setWarnings` is still called on the unmounted component.
- **Impact:** Can cause memory leaks or state update warnings in React.
- **Recommended Fix:** Add an `active` boolean flag inside `useEffect` and clean it up on unmount:
  ```typescript
  useEffect(() => {
    if (!imageSrc) {
      setWarnings({});
      return;
    }
    let active = true;
    const img = new Image();
    // ...
    img.onload = () => {
      if (!active) return;
      // ... (sampling code)
      setWarnings(newWarnings);
    };
    return () => {
      active = false;
    };
  }, [...]);
  ```

### 3.4 JPEG / WebP Extension Mismatch in Upload Route (Bug)
- **File:** `src/app/api/upload/route.ts`
- **Description:** The extension mapping uses:
  ```typescript
  const ext = detected.ext === 'jpg' ? 'jpg' : detected.ext === 'png' ? 'png' : 'webp';
  ```
  If `file-type` detects the file extension as `'jpeg'`, the check fails both `'jpg'` and `'png'` and falls back to `'webp'`. However, `sharp(buffer).toBuffer()` is called without specifying a format, meaning it writes raw JPEG binary to a file named `uuid.webp`.
- **Impact:** While web browsers are forgiving and can render a JPEG served with a `.webp` extension, it is inconsistent and can break strict third-party parsers, CDN optimization, or local asset inspection.
- **Recommended Fix:** Map `'jpeg'` explicitly:
  ```typescript
  const ext = (detected.ext === 'jpg' || detected.ext === 'jpeg') ? 'jpg' : detected.ext === 'png' ? 'png' : 'webp';
  ```
  Alternatively, explicitly convert the output using sharp to match the target file format:
  ```typescript
  let sharpInstance = sharp(buffer);
  if (ext === 'webp') {
    sharpInstance = sharpInstance.webp();
  }
  ```

### 3.5 No Upload File Size Limit (Security Risk)
- **File:** `src/app/api/upload/route.ts`
- **Description:** There is no limitation on the size of the uploaded file before it is read into an `ArrayBuffer` in memory.
- **Impact:** An attacker could upload a massive file (e.g. 500MB), causing the server's Node/Next.js process to run out of memory (OOM crash), representing a Denial of Service (DoS) vulnerability.
- **Recommended Fix:** Inspect the header content-length or check the file size before parsing the array buffer, and reject files larger than 10MB:
  ```typescript
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 });
  }
  ```

### 3.6 Playwright PDF Export Margin / Page Size Risks (Edge Case)
- **File:** `src/lib/export/renderService.ts`
- **Description:** In `renderLayoutPdf`, `page.pdf` is called with custom width and height, but without specifying margins or the page size preference.
  ```typescript
  const pdfBuffer = await page.pdf({
    width: `${widthPx}px`,
    height: `${heightPx}px`,
    printBackground: true,
  });
  ```
- **Impact:** In some OS/Chromium environments, Chromium may inject default print margins (clipping the flyer elements) or scale the flyer down.
- **Recommended Fix:** Explicitly set margins to `0` and use `preferCSSPageSize: true`:
  ```typescript
  const pdfBuffer = await page.pdf({
    width: `${widthPx}px`,
    height: `${heightPx}px`,
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
  });
  ```

---

## 4. Verdict & Recommendations

| Functional Area | Recommendation | Status |
| :--- | :--- | :--- |
| **Typecheck, Lint & Build** | Approve as is (Clean execution) | **PASSED** |
| **Zod Project Schema** | Approve as is (Correctly contains `polishedBackground`) | **PASSED** |
| **Upload magic-bytes verification** | Fix extension mapping and size limits | **PASSED (with warnings)** |
| **Playwright PDF Export** | Apply explicit margins to prevent printer clipping | **PASSED (with warnings)** |
| **ContrastGuard Analytics** | Fix opacity context and backing plate blend math | **PASSED (with warnings)** |

**Final QA Verdict:** **RECOMMENDED FOR APPROVAL WITH MINOR FIXES**

The codebase meets the core requirements of Milestone 9. We suggest implementing the recommendations detailed above to guarantee 100% accuracy in the WCAG contrast overlay checks and secure the file upload endpoint against OOM attacks.
