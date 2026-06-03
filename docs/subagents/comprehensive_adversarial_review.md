# Comprehensive Adversarial Review

Repository audited: `AdGen`  
Stack observed: Next.js 16 App Router, Prisma + SQLite, Zustand, Sharp, Playwright

Scope covered:
- API upload and export routes
- Playwright render pipeline
- Prisma/SQLite access patterns
- Layout solver and text fitting
- Zustand editor state
- Contrast/accessibility heuristics

Notes:
- I did not find evidence of Prisma raw SQL usage.
- I did not find a path traversal in the upload write path because filenames are server-generated UUIDs under `public/uploads`.
- I did find several production blockers around export security, upload resource exhaustion, and concurrency handling.

## 1. Critical Severity Findings

### 1.1 Stored SVG XSS via unescaped attribute values

**Evidence**
- `src/lib/export/renderService.ts:320-347` interpolates `fontFamily`, `fontWeight`, and `color` directly into SVG attributes.
- `src/lib/export/renderService.ts:361-367` only escapes text-node content, not attribute values.
- `src/lib/schemas/project.ts:43-47` and `233-245` allow arbitrary strings for `brand.fontPreferences.*` and `style.fontFamily` / `style.fontWeight`.
- `src/components/editor/LeftSidebar.tsx:158-170` exposes `brand.fontPreferences.*` as raw text inputs.

**Why this is exploitable**
- A user can save a font family such as `foo" /><script>alert(1)</script><text x="0`.
- `GET /api/export/overlay?id=...&format=svg` returns `image/svg+xml` built from that stored value.
- That turns the exported SVG into an active script container when opened directly, embedded as an object, or handled by downstream tooling that trusts same-origin SVG.

**Impact**
- Stored XSS against anyone opening the exported SVG.
- Same-origin script execution can exfiltrate project data, authenticated responses, or trigger destructive actions through the UI.

**Remediation**
- Stop building SVG with string interpolation for untrusted attribute values.
- Strictly allowlist font family tokens and font-weight values before persistence.
- Escape XML attributes separately from text nodes, or switch to an XML builder that handles attribute encoding.
- Add a restrictive CSP for SVG responses if they must remain browser-viewable.

### 1.2 Upload endpoint is vulnerable to memory and image-decompression exhaustion

**Evidence**
- `src/app/api/upload/route.ts:11-20` checks `content-length`, but that header is optional and not trustworthy for chunked uploads.
- `src/app/api/upload/route.ts:22` calls `request.formData()`, which requires the multipart body to be fully materialized before the file can be inspected.
- `src/app/api/upload/route.ts:36-37` then copies the uploaded file again with `file.arrayBuffer()` into a Node `Buffer`.
- `src/app/api/upload/route.ts:59-64` passes the whole buffer into Sharp without `limitInputPixels` or equivalent guardrails.

**Why this is exploitable**
- A client can omit or spoof `content-length`, forcing the server to buffer the request before the 10 MB check at `file.size`.
- A small compressed image with enormous decoded dimensions can push Sharp/libvips into extreme memory use during decode or transcode.

**Impact**
- Process-level OOM and request starvation on a single node.
- Easy denial of service against `/api/upload` under modest parallelism.

**Remediation**
- Enforce request-body limits at the HTTP/proxy layer before Next.js parses the body.
- Replace `request.formData()` for this route with a streaming multipart parser and reject oversized payloads while streaming.
- Configure Sharp with explicit pixel/memory limits, for example `sharp(buffer, { limitInputPixels: ... })`.
- Reject pathological dimensions before writing to disk or DB.

## 2. Medium Severity Findings

### 2.1 Export pipeline launches a fresh Chromium per request with no backpressure

**Evidence**
- `src/lib/export/renderService.ts:42-45`, `120-122`, `203-205`, and `400-403` each launch a new browser instance.
- `src/lib/export/renderService.ts:67-69`, `141`, `153`, `227-229`, and `425-427` immediately navigate and render with no queue or semaphore.
- `src/app/render-canvas/page.tsx:64-66` loads all assets for every render request, amplifying export cost as the asset table grows.

**Impact**
- Under concurrent PDF/PNG export bursts, the node will try to run many full Chromium processes at once.
- That creates a practical CPU/RAM exhaustion path even without malicious payloads.
- Asset-table growth also makes every export slower than necessary.

**Remediation**
- Keep one long-lived browser and create isolated contexts/pages per job.
- Add a bounded render queue or semaphore.
- Fetch only the assets referenced by the rendered project instead of `findMany()` across the whole table.

### 2.2 Project saves are last-write-wins and can silently destroy concurrent edits

**Evidence**
- `src/lib/store/editorStore.ts:325-345` saves the entire project snapshot with a blind `PUT`.
- `src/app/api/projects/[id]/route.ts:18-49` validates the payload, then overwrites `contentJson` with no version check, ETag, or `updatedAt` compare.
- `src/lib/store/editorStore.ts:141-158`, `161-214`, `217-285` mutate a full cloned document on every interaction, making stale whole-document saves common in multi-tab use.

**Impact**
- Two editors or two browser tabs can overwrite each other with no conflict signal.
- In heavy workflows, the later save silently discards earlier changes. This is data loss, not just a UX issue.

**Remediation**
- Add optimistic concurrency control using a revision number or `updatedAt` precondition.
- Reject stale saves with `409 Conflict`.
- Prefer diff/patch style updates for granular edits.

### 2.3 Local save completion can falsely clear unsaved state

**Evidence**
- `src/lib/store/editorStore.ts:325-345` snapshots `const project = get().project`, sets `isSaving`, sends that snapshot, and unconditionally finishes with `set({ isSaving: false, hasUnsavedChanges: false })` on success.
- The same store accepts new edits during the request through `updateProjectField`, `updateSection`, `updateItem`, `reorderSections`, and `reorderItems` at `src/lib/store/editorStore.ts:141-285`.

**Why this is a real bug**
- A user can press Save, then continue editing before the request returns.
- The request persists the older snapshot, not the newer edits.
- When the request resolves, the store still clears `hasUnsavedChanges`, even though the latest local state was never sent.

**Impact**
- The UI can show a false "Saved" state for unsaved local edits.
- If the user navigates away after that false success state, those newer edits are lost.

**Remediation**
- Associate each save with a local revision or monotonic counter captured at request start.
- Only clear `hasUnsavedChanges` if the current revision still matches the saved revision when the response returns.
- Alternatively, disable editing during save, or immediately queue a follow-up save when local mutations occur mid-flight.

### 2.4 ContrastGuard reports false passes on high-variance backgrounds and silently disables itself on tainted canvases

**Evidence**
- `src/components/editor/ContrastGuard.tsx:83-85` loads the image with `crossOrigin = 'anonymous'`, but `Asset.filePath` is unrestricted (`src/lib/schemas/project.ts:82-105`).
- `src/components/editor/ContrastGuard.tsx:163-205` reduces the sampled area to a single average luminance value.
- `src/components/editor/ContrastGuard.tsx:221-233` logs sampling/load errors and clears warnings instead of surfacing that contrast validation is unavailable.

**Impact**
- Busy or checkered backgrounds can average to a "safe" gray while text is unreadable on large portions of the area.
- If an external or misconfigured asset taints the canvas, the user sees no warning even though the checker is effectively off.

**Remediation**
- Track luminance variance and worst-case contrast, not only the mean.
- Surface a distinct "contrast check unavailable" state when sampling fails.
- Constrain `Asset.filePath` to trusted origins if external assets are not intended.

### 2.5 Layout solver accepts impossible safe margins and produces invalid geometry

**Evidence**
- `src/lib/schemas/project.ts:7-15` only requires `safeMarginPx` to be non-negative.
- `src/lib/layout/solver.ts:12-16` computes `safeWidth` and `safeHeight` directly from that margin.
- `src/lib/layout/solver.ts:31`, `55`, `82`, `135`, `171-205`, and `236-238` continue using those derived dimensions even when they go negative.

**Impact**
- Crafted or imported project JSON can produce negative widths/heights and backwards coordinates.
- That is likely to create broken exports, invisible content, and inconsistent editor/render behavior.

**Remediation**
- Validate `safeMarginPx < widthPx / 2` and `safeMarginPx < heightPx / 2`.
- Fail fast on impossible canvas geometry instead of trying to render it.

### 2.6 Rendered text fidelity is not stable because brand fonts are user-controlled but not actually provisioned

**Evidence**
- `src/components/editor/LeftSidebar.tsx:158-170` allows arbitrary font family strings.
- `src/lib/layout/solver.ts` and `src/lib/export/renderService.ts:320-346` use those names to size and emit text.
- `src/app/layout.tsx:1-18` only provisions `Geist` and `Geist_Mono`; there is no dynamic font loading for project-selected families.

**Impact**
- Exported PNG/PDF/SVG output can drift from the intended layout when the chosen font is unavailable and the browser falls back.
- The text-fit heuristic is already approximate; missing fonts compounds truncation and alignment errors.

**Remediation**
- Replace free-form font family input with an allowlisted catalog of provisioned fonts.
- Ensure the same fonts are loaded in the editor, `/render-canvas`, and export environment.

## 3. Low Severity / Best Practice Recommendations

### 3.1 Undo/redo history and edit handling are unnecessarily expensive

**Evidence**
- `src/lib/store/editorStore.ts:29-30` deep-clones via `JSON.parse(JSON.stringify(...))`.
- `src/lib/store/editorStore.ts:141-158`, `161-214`, `217-285` clone entire projects and re-run `solveLayout` on every edit.
- `src/lib/store/editorStore.ts:153-156`, `175-178`, `208-211`, `246-249`, `280-283` append unbounded full-project snapshots to history stacks.

**Impact**
- Large projects will accumulate memory quickly and pay synchronous CPU cost on each keystroke.
- This is a performance risk rather than an immediate exploit.

**Remediation**
- Cap history depth.
- Move layout recomputation behind debouncing or targeted recompute boundaries.
- Use structural sharing instead of full JSON round-trips.

### 3.2 `tsc --noEmit` is not aligned with the Next.js 16 generated type workflow

**Evidence**
- `npm run typecheck` currently fails with:

```text
.next/types/validator.ts(5,79): error TS2307: Cannot find module './routes.js' or its corresponding type declarations.
```

**Impact**
- CI that relies on the standalone `typecheck` script will fail even though `next build` succeeds.

**Remediation**
- Make `typecheck` run after `next typegen`, or use the Next-supported typecheck path that mirrors build.
- Treat `.next/types` as generated artifacts, not a stable input to raw `tsc` without type generation.

## 4. Validation Command Log

### `npm run typecheck`

```powershell
> ad-gen@0.1.0 typecheck
> tsc --noEmit

.next/types/validator.ts(5,79): error TS2307: Cannot find module './routes.js' or its corresponding type declarations.
```

Result: failed

### `npm run lint`

```powershell
> ad-gen@0.1.0 lint
> eslint
```

Result: passed

### `npm run test`

```powershell
> ad-gen@0.1.0 test
> vitest run


 RUN  v4.1.8 C:/Software/AdGen


 Test Files  10 passed (10)
      Tests  78 passed (78)
   Start at  09:24:35
   Duration  5.33s (transform 963ms, setup 2.22s, import 2.45s, tests 2.51s, environment 24.44s)
```

Result: passed

### `npm run build`

```powershell
> ad-gen@0.1.0 build
> next build

▲ Next.js 16.2.7 (Turbopack)

  Creating an optimized production build ...
✓ Compiled successfully in 3.3s
  Running TypeScript ...
  Finished TypeScript in 3.7s ...
  Collecting page data using 13 workers ...
  Generating static pages using 13 workers (0/4) ...
  Generating static pages using 13 workers (1/4) 
  Generating static pages using 13 workers (2/4) 
  Generating static pages using 13 workers (3/4) 
✓ Generating static pages using 13 workers (4/4) in 667ms
  Finalizing page optimization ...

Route (app)
┌ ƒ /
├ ○ /_not-found
├ ƒ /api/export/overlay
├ ƒ /api/export/package
├ ƒ /api/export/pdf
├ ƒ /api/export/render
├ ƒ /api/projects/[id]
├ ƒ /api/upload
├ ƒ /editor/[id]
└ ƒ /render-canvas


○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

Result: passed

## Recommended Fix Order

1. Fix SVG export attribute injection.
2. Put hard streaming limits in front of `/api/upload` and add Sharp pixel guards.
3. Add export queueing/browser pooling before production traffic.
4. Add optimistic concurrency to project saves.
5. Tighten schema validation for fonts, assets, and canvas geometry.
