# Changelog

All notable changes to AdGen are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] — 2026-06-04

### Added

**Core Infrastructure**
- Next.js 16 App Router project with TypeScript strict mode
- SQLite database via Prisma ORM with `better-sqlite3` adapter
- Zod 4 schema validation for all domain objects
- HMAC-signed session cookie authentication with role-based access
- Development auto-login for local development
- Rate limiting for upload and export endpoints

**Content Management**
- Project creation and persistence with hybrid JSON storage
- Section and item CRUD operations
- CSV import with quoted-field support and auto-section creation
- Item priorities: hero, featured, normal, compact, hidden
- Badge system: NEW, SALE, USED, LIMITED, and custom text
- Price formatting with sale price support

**Layout Engine**
- Pure TypeScript deterministic layout solver (Hierarchical Grid Partitioning)
- Inventory board layout family
- Hero + grid layout family
- Menu / listing board layout family
- Density control: loose, normal, dense
- Layout scoring and overflow detection
- Character-based text fitting heuristics
- Safe margin and gutter calculations

**Editor UI**
- Full workspace with left sidebar, center canvas, and right property inspector
- Content tab with section/item management
- Brand configuration tab (colors, fonts, contact, disclaimers, style keywords)
- Layout family picker with density slider
- Drag-and-drop item reordering via @dnd-kit
- Property inspector for selected elements
- Zustand state management with undo/redo support
- Real-time canvas preview

**Rendering Pipeline**
- HTML/SVG canvas preview renderer
- Background-only renderer (text masked for AI handoff)
- Exact text overlay renderer (transparent PNG and SVG)
- QR code generation

**Export Pipeline**
- PNG export via Playwright headless rendering
- PDF export with vector text paths
- SVG text overlay export
- AI prompt generation from project data
- Negative prompt generation
- ZIP handoff package with structured file layout

**Asset Management**
- Secure image upload with magic-byte validation (file-type)
- EXIF metadata stripping for privacy
- EXIF orientation normalization
- Sharp-based image processing and thumbnailing
- UUID filename assignment (directory traversal prevention)
- Decompression bomb protection (8000px dimension cap)
- Automatic rollback on upload failure

**Validation System**
- Text overflow detection
- Tiny text warnings (< 10px)
- Overcrowding detection
- Low resolution image warnings
- Missing required field warnings
- Legal/compliance copy validation
- Low contrast ratio warnings (WCAG AA)

**AI Polish Workflow**
- Polished background import
- Exact content overlay compositing
- Contrast Guard for overlay readability checking
- Export settings: exact text overlay, AI polish mode selection

**Testing**
- Vitest unit test suite (15 test files)
- Playwright E2E test infrastructure
- Tests for: layout solver, CSV parser, authentication, renderer, editor, export, overlay, composite, storage, text fitting

**Database Seed**
- CFC Tactical Handgun Board sample project (5 sections, 21 items)
- Dark Tactical Inventory Board layout template
- Sample asset records

**Documentation**
- Architecture documentation
- Design decisions documentation
- Testing strategy documentation
- API reference
- User guide
- Contributing guidelines
