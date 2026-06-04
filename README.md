<div align="center">

# AdGen — Template-to-Flyer Generator

**Turn structured content into professional visual layouts, then polish them with AI.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma)](https://www.prisma.io/)
[![SQLite](https://img.shields.io/badge/SQLite-local-003B57?logo=sqlite)](https://www.sqlite.org/)
[![License](https://img.shields.io/badge/License-Private-red)](#license)

</div>

---

## What Is AdGen?

AdGen is a **structured flyer compiler and visual editor** that helps small business owners, marketers, and operators create polished inventory boards, sale flyers, event posters, menus, and social media ads — fast.

Instead of manual design in Canva or Photoshop, AdGen separates **content truth** (product names, prices, contact info) from **visual styling** (backgrounds, textures, lighting). You organize your data, AdGen generates accurate rough layouts, and then an AI image generator polishes the design while AdGen guarantees every price, phone number, and disclaimer stays pixel-perfect.

### The Core Workflow

```
┌─────────────┐    ┌──────────────┐    ┌───────────────┐    ┌─────────────────┐
│  Add Content │───▶│ Generate     │───▶│ Export AI     │───▶│ Import Polished │
│  (CSV/manual)│    │ Layout       │    │ Handoff Pkg   │    │ + Overlay Text  │
└─────────────┘    └──────────────┘    └───────────────┘    └─────────────────┘
```

1. **Add content** — Enter items manually, paste from a spreadsheet, or upload a CSV.
2. **Generate layout** — Choose a layout family and density; AdGen produces deterministic, accurate rough layouts.
3. **Export for AI polish** — Download a ZIP containing the rough layout, prompts, and overlay assets.
4. **Re-import & composite** — Upload the AI-polished background, overlay your exact text/prices, and export the final print-ready file.

---

## Features

| Category | What's Included |
|---|---|
| **Content Management** | Sections, items, drag-and-drop reordering, CSV import, inline editing, badges (NEW / SALE / USED), sale prices |
| **Layout Engine** | Deterministic grid solver with inventory board, hero+grid, and menu/listing families; density control (loose / normal / dense); layout scoring and overflow detection |
| **Brand System** | Reusable brand profiles with colors, fonts, logos, contact info, disclaimers, and style keywords |
| **Canvas Presets** | Letter (8.5×11), Poster (11×17), Instagram Square/Portrait, Facebook, Web Banner, and custom sizes |
| **Rendering** | HTML/SVG canvas preview, background-only renderer, exact text overlay renderer |
| **Export Pipeline** | PNG, PDF, SVG, transparent text overlay, AI prompt file, negative prompt, ZIP handoff package |
| **AI Polish Workflow** | Import polished backgrounds, re-apply exact overlays, contrast checking, composite export |
| **Editor** | Left sidebar (content/assets/brand), center canvas, right property inspector, drag card reordering, resize, hero promotion |
| **Validation** | Missing images, text overflow, tiny text, overcrowding, low resolution, missing prices, legal/compliance, contrast ratio |
| **Auth** | HMAC-signed session cookies; development auto-login; role-based access (admin/user) |
| **Asset Management** | Secure upload with magic-byte validation, EXIF stripping, Sharp thumbnails, focal point cropping |

---

## Quick Start

### Prerequisites

| Requirement | Version |
|---|---|
| **Node.js** | 18.17 or later |
| **npm** | 9 or later |
| **Git** | Any recent version |

### 1. Clone & Install

```bash
git clone <repository-url> AdGen
cd AdGen
npm install
```

### 2. Initialize the Database

AdGen uses SQLite through Prisma. Set up the database and seed it with sample data:

```bash
npx prisma migrate dev
npx prisma db seed
```

This creates a `dev.db` file in the project root and populates it with a **CFC Tactical Handgun Board** sample project containing 5 sections, 21 items, and a reusable layout template.

### 3. Start the Dev Server

```bash
npm run dev
```

Open **http://localhost:3000** in your browser. You'll see the dashboard with your seeded project ready to open.

### 4. Open the Editor

Click **"Open Seeded Project"** or any project card to launch the full editor workspace with the canvas preview, sidebar controls, and property inspector.

---

## Available Scripts

| Script | Command | Description |
|---|---|---|
| **Dev server** | `npm run dev` | Start Next.js in development mode with hot reload |
| **Build** | `npm run build` | Create a production build |
| **Start** | `npm run start` | Run the production build |
| **Lint** | `npm run lint` | Run ESLint checks |
| **Type check** | `npm run typecheck` | Run TypeScript compiler in check mode |
| **Unit tests** | `npm run test` | Run Vitest unit test suite |
| **Unit tests (watch)** | `npm run test:watch` | Run Vitest in watch mode |
| **E2E tests** | `npm run test:e2e` | Run Playwright end-to-end tests |
| **Format** | `npm run format` | Auto-format code with Prettier |
| **DB migrate** | `npx prisma migrate dev` | Apply pending database migrations |
| **DB seed** | `npx prisma db seed` | Seed the database with sample data |
| **DB studio** | `npx prisma studio` | Open the Prisma database GUI |

---

## Project Structure

```
AdGen/
├── prisma/
│   ├── schema.prisma          # Database schema (Project, Template, Asset)
│   ├── seed.ts                # Sample data seeder (CFC Tactical board)
│   └── migrations/            # Auto-generated Prisma migrations
│
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── page.tsx           # Dashboard — project list and creation
│   │   ├── layout.tsx         # Root HTML layout with fonts
│   │   ├── error.tsx          # Global error boundary
│   │   ├── globals.css        # Global styles (Tailwind base)
│   │   ├── editor/[id]/       # Dynamic editor workspace route
│   │   ├── render-canvas/     # Server-side canvas rendering endpoint
│   │   └── api/
│   │       ├── projects/      # Project save API
│   │       ├── upload/        # Secure asset upload endpoint
│   │       └── export/
│   │           ├── render/    # PNG export via Playwright
│   │           ├── pdf/       # PDF export via Playwright
│   │           ├── overlay/   # Transparent text overlay export
│   │           └── package/   # ZIP handoff package export
│   │
│   ├── components/
│   │   ├── editor/            # Editor UI components
│   │   │   ├── EditorWorkspace.tsx   # Main editor layout & canvas
│   │   │   ├── LeftSidebar.tsx       # Content, assets, brand tabs
│   │   │   ├── RightInspector.tsx    # Property panel for selections
│   │   │   ├── ContentTableMode.tsx  # Table view for item management
│   │   │   └── ContrastGuard.tsx     # Text-to-background contrast checker
│   │   └── renderer/          # Canvas rendering components
│   │       ├── CanvasPreview.tsx      # Main preview wrapper
│   │       ├── BackgroundRenderer.tsx # Layout skeleton renderer
│   │       ├── OverlayRenderer.tsx    # Exact text overlay renderer
│   │       └── QRCodeImage.tsx        # QR code generator
│   │
│   ├── lib/
│   │   ├── db.ts              # Prisma client singleton with retry logic
│   │   ├── auth/server.ts     # HMAC session auth + dev auto-login
│   │   ├── schemas/
│   │   │   └── project.ts     # Zod schemas for all domain types
│   │   ├── layout/
│   │   │   ├── solver.ts      # Deterministic layout engine (HGP solver)
│   │   │   └── textFit.ts     # Character-based text fitting heuristics
│   │   ├── export/
│   │   │   ├── renderService.ts   # Playwright-based PNG/PDF renderer
│   │   │   ├── promptBuilder.ts   # AI prompt generation from project data
│   │   │   └── zipPackager.ts     # ZIP handoff package builder
│   │   ├── store/
│   │   │   └── editorStore.ts # Zustand state management with undo/redo
│   │   ├── validation/
│   │   │   └── rules.ts       # Layout validation rules & warnings
│   │   ├── renderer/
│   │   │   ├── types.ts       # Render pipeline type definitions
│   │   │   └── utils.ts       # Rendering utility functions
│   │   └── utils/
│   │       ├── csv.ts         # CSV parser with quoted-field support
│   │       ├── formatters.ts  # Currency formatting utilities
│   │       ├── color.ts       # Color manipulation helpers
│   │       ├── crop.ts        # Image cropping calculation
│   │       ├── storage.ts     # File storage abstraction
│   │       └── rateLimiter.ts # API rate limiting
│   │
│   └── test/                  # Unit test suite (15 test files)
│       ├── setup.ts           # Vitest test environment setup
│       ├── solver.test.ts     # Layout engine tests
│       ├── csv.test.ts        # CSV parser tests
│       ├── auth.test.ts       # Authentication tests
│       ├── renderer.test.tsx  # Renderer component tests
│       ├── editor.test.tsx    # Editor workspace tests
│       └── ...                # Additional test files
│
├── e2e/                       # Playwright end-to-end tests
├── docs/                      # Technical documentation
│   ├── ARCHITECTURE.md        # System architecture & module design
│   ├── DECISIONS.md           # Design decisions & trade-offs
│   ├── TESTING_STRATEGY.md    # Testing framework & methodology
│   ├── USAGE_GUIDE.md         # Step-by-step user workflow guide
│   └── API_REFERENCE.md       # REST API endpoint reference
│
├── public/uploads/            # Runtime asset storage (gitignored)
├── package.json               # Dependencies and scripts
├── tsconfig.json              # TypeScript configuration
├── vitest.config.ts           # Unit test configuration
├── playwright.config.ts       # E2E test configuration
└── prisma.config.ts           # Prisma CLI configuration
```

---

## How It Works

### Content Truth vs. Visual Styling

AdGen's design philosophy revolves around one key insight: **AI image generators are great at visual polish but terrible at preserving exact text.** AdGen solves this by splitting every flyer into two layers:

| Layer | Handled By | Contains |
|---|---|---|
| **Background / Style** | AI image generator | Textures, borders, shadows, lighting, decorative framing, color gradients, polish |
| **Content Overlay** | AdGen (deterministic) | Product names, prices, phone numbers, emails, URLs, disclaimers, QR codes, logos |

This means you get the visual quality of AI generation with the accuracy of deterministic rendering — no hallucinated phone numbers, no misspelled product names.

### Layout Engine

The layout engine is a **pure TypeScript solver** with no browser dependencies. It uses hierarchical grid partitioning (HGP) to:

1. Reserve safe margins
2. Allocate header, footer, and hero blocks
3. Divide remaining space into section bands
4. Compute grid columns per section based on item count and density
5. Calculate exact bounding boxes for every card, text element, and image
6. Score the layout and flag overflow warnings

The engine supports three layout families:

- **Inventory Board** — Dense grid with grouped sections (like the CFC Tactical example)
- **Hero + Grid** — Large featured item with supporting grid
- **Menu / Listing Board** — Text-heavy layout with price columns

### AI Handoff Package

When you export for AI polish, AdGen creates a structured ZIP containing:

```
project-name-ai-handoff.zip
├── README.md                          # Instructions for the AI workflow
├── prompt.md                          # Generated visual design prompt
├── negative-prompt.txt                # What the AI should avoid
├── rough-layout.png                   # Full rough layout reference
├── rough-layout-background-only.png   # Layout with text masked out
├── exact-text-overlay.svg             # Transparent text overlay
├── exact-text-overlay.png             # Transparent text overlay (raster)
├── project.json                       # Full project data
├── content.json                       # Item/section data
├── layout.json                        # Computed layout coordinates
├── brand.json                         # Brand profile
└── assets/                            # Product images and logos
```

---

## Configuration

### Environment Variables

Create a `.env.local` file in the project root for local overrides:

| Variable | Required | Default | Description |
|---|---|---|---|
| `ADGEN_AUTH_SECRET` | No | — | HMAC secret for signing session cookies. When unset in development, auto-login is enabled. |
| `ADGEN_DEV_USER_ID` | No | `dev_user` | User ID for development auto-login |
| `ADGEN_DEV_USER_ROLE` | No | `admin` | Role for development auto-login (`admin` or `user`) |
| `NODE_ENV` | No | `development` | Set to `production` to enforce authentication |

### Authentication

AdGen uses **HMAC-signed session cookies** for authentication:

- **Development mode** (no `ADGEN_AUTH_SECRET` set): Auto-login is enabled. All requests are treated as the `dev_user` with `admin` role.
- **Production mode**: `ADGEN_AUTH_SECRET` must be set. Sessions are signed with HMAC-SHA256 and include expiry validation.

You can also send `x-user-id` and `x-user-role` headers during development for testing different user contexts.

### Database

AdGen uses **SQLite** via Prisma with the `better-sqlite3` driver. The database file (`dev.db`) is created automatically in the project root.

- Schema is defined in [`prisma/schema.prisma`](prisma/schema.prisma)
- Migrations are managed with `npx prisma migrate dev`
- Visual database browser: `npx prisma studio`

---

## Supported Canvas Sizes

| Format | Dimensions | Use Case |
|---|---|---|
| Letter flyer | 8.5 × 11 in (2550 × 3300 px) | Standard print flyers |
| Poster | 11 × 17 in (3300 × 5100 px) | Large-format boards |
| Instagram Square | 1080 × 1080 px | Social media posts |
| Instagram Portrait | 1080 × 1350 px | Vertical social cards |
| Facebook Post | 1200 × 1500 px | Facebook ads |
| Web Banner | 1920 × 1080 px | Website headers |
| Custom | User-defined | Any custom dimensions |

All exports support **300 DPI** for print quality and include safe margin calculations.

---

## CSV Import Format

You can bulk-import items using CSV files with the following columns:

```csv
section,title,subtitle,description,price,sale_price,badge,image,priority,tags
Compact / Carry-Size,Smith & Wesson M&P9 Shield Plus,9mm | Compact,,530,,,images/shield-plus.jpg,normal,"compact,9mm"
Range / Training,Sig Sauer P322,.22 LR | Range / training,,400,,,images/p322.jpg,normal,"training,22lr"
Premium / Used,Atlas Gunworks Apollo V2,9mm | Used premium,,6250,,USED,images/atlas-apollo.jpg,hero,"premium,used"
```

| Column | Required | Description |
|---|---|---|
| `section` | Yes | Section name (auto-created if new) |
| `title` | Yes | Item display name |
| `subtitle` | No | Caliber, category, or short descriptor |
| `description` | No | Longer item description |
| `price` | No | Numeric price value |
| `sale_price` | No | Numeric sale price (shows original crossed out) |
| `badge` | No | Badge text (e.g., `NEW`, `SALE`, `USED`, `LIMITED`) |
| `image` | No | Path to item image file |
| `priority` | No | `hero`, `featured`, `normal`, or `compact` |
| `tags` | No | Comma-separated tag list |

---

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Framework** | Next.js 16 (App Router) | Full-stack React framework |
| **Language** | TypeScript 5 | Type-safe development |
| **Styling** | Tailwind CSS 4 | Utility-first CSS framework |
| **State** | Zustand | Editor state management with undo/redo |
| **Drag & Drop** | @dnd-kit | Content reordering and card manipulation |
| **Database** | SQLite + Prisma 7 | Local-first data persistence |
| **Image Processing** | Sharp | Thumbnails, cropping, EXIF stripping |
| **PDF/PNG Export** | Playwright | Headless browser rendering at print resolution |
| **QR Codes** | qrcode | Dynamic QR code generation |
| **ZIP Packaging** | Archiver | AI handoff package bundling |
| **Validation** | Zod 4 | Runtime schema validation with migrations |
| **Icons** | Lucide React | UI icon library |
| **Unit Testing** | Vitest + Testing Library | Fast unit and component tests |
| **E2E Testing** | Playwright Test | Browser-based integration tests |
| **Formatting** | Prettier + ESLint | Code quality and consistency |

---

## Testing

AdGen uses a three-tiered testing strategy:

### Unit Tests (Vitest)

Fast, Node-based tests covering the layout solver, CSV parser, price formatter, text fitting, validation rules, authentication, and renderer components.

```bash
npm run test           # Run once
npm run test:watch     # Watch mode
```

### End-to-End Tests (Playwright)

Browser-based tests verifying the full workflow including editor interactions, export generation, and visual regression.

```bash
npm run test:e2e
```

### Type Checking

```bash
npm run typecheck
```

For detailed testing documentation, see [`docs/TESTING_STRATEGY.md`](docs/TESTING_STRATEGY.md).

---

## Documentation

| Document | Description |
|---|---|
| [**README.md**](README.md) | This file — project overview, quickstart, and reference |
| [**docs/ARCHITECTURE.md**](docs/ARCHITECTURE.md) | System architecture, module design, and data flows |
| [**docs/DECISIONS.md**](docs/DECISIONS.md) | Design decisions and trade-off rationale |
| [**docs/TESTING_STRATEGY.md**](docs/TESTING_STRATEGY.md) | Test framework, scopes, and golden test cases |
| [**docs/USAGE_GUIDE.md**](docs/USAGE_GUIDE.md) | Step-by-step user guide for creating flyers |
| [**docs/API_REFERENCE.md**](docs/API_REFERENCE.md) | REST API endpoints and request/response schemas |
| [**CONTRIBUTING.md**](CONTRIBUTING.md) | Development workflow and contribution guidelines |
| [**CHANGELOG.md**](CHANGELOG.md) | Version history and release notes |

---

## Current Status

AdGen is in **active early development** (v0.1.0). The following milestones track progress:

- [x] **Phase 0** — Discovery & prototype (JSON schema, static renderer proof)
- [x] **Phase 1** — Content model & renderer (Prisma schema, section/item CRUD, canvas renderer)
- [x] **Phase 2** — Layout engine (inventory board solver, scoring, overflow detection)
- [x] **Phase 3** — Editor (workspace UI, sidebar, inspector, drag/reorder, undo/redo)
- [x] **Phase 4** — AI handoff (prompt builder, overlay export, ZIP packager)
- [x] **Phase 5** — Polished image import & composite export
- [ ] **Phase 6** — Template marketplace & additional layout families
- [ ] **Phase 7** — Direct AI API integration
- [ ] **Phase 8** — Multi-page catalogs & advanced card variants

---

## License

This project is **private and proprietary**. All rights reserved. See [LICENSE](LICENSE) for details.
