# Usage Guide

A step-by-step walkthrough for creating, editing, and exporting professional flyers with AdGen.

---

## Table of Contents

- [Starting the Application](#starting-the-application)
- [Dashboard Overview](#dashboard-overview)
- [Creating a New Project](#creating-a-new-project)
- [Adding Content](#adding-content)
  - [Manual Entry](#manual-entry)
  - [CSV Import](#csv-import)
- [Using the Editor](#using-the-editor)
  - [Left Sidebar](#left-sidebar)
  - [Canvas Preview](#canvas-preview)
  - [Right Inspector](#right-inspector)
- [Layout Generation](#layout-generation)
- [Brand Configuration](#brand-configuration)
- [Exporting Your Flyer](#exporting-your-flyer)
  - [PNG Export](#png-export)
  - [PDF Export](#pdf-export)
  - [AI Handoff Package](#ai-handoff-package)
- [AI Polish Workflow](#ai-polish-workflow)
  - [Step 1: Export for AI](#step-1-export-for-ai)
  - [Step 2: Run AI Generation](#step-2-run-ai-generation)
  - [Step 3: Import Polished Background](#step-3-import-polished-background)
  - [Step 4: Overlay Exact Content](#step-4-overlay-exact-content)
  - [Step 5: Export Final Composite](#step-5-export-final-composite)
- [Working with Validation Warnings](#working-with-validation-warnings)
- [Tips & Best Practices](#tips--best-practices)

---

## Starting the Application

1. Make sure your database is set up:
   ```bash
   npx prisma migrate dev
   npx prisma db seed      # Optional: loads sample CFC Tactical project
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open **http://localhost:3000** in your browser.

> **Note:** In development mode, authentication is handled automatically. You're logged in as `dev_user` with `admin` role by default.

---

## Dashboard Overview

The dashboard at `/` is your home screen. From here you can:

- **View all projects** — Each project card shows its name, type, and last-modified time.
- **Open the seeded sample** — Click "Open Seeded Project" to jump into the pre-loaded CFC Tactical Handgun Board.
- **Create a new project** — Click "Create New Project" to start from scratch with a default template.

---

## Creating a New Project

When you click **"Create New Project"**, AdGen creates a project with these defaults:

| Setting | Default Value |
|---|---|
| Canvas size | Letter (8.5" × 11") at 300 DPI |
| Layout family | Inventory Board |
| Density | Normal |
| Brand colors | White background, black text |
| AI polish mode | Background & Style (recommended) |
| Exact text overlay | Enabled |

You'll be redirected to the editor where you can immediately start adding content and customizing.

---

## Adding Content

### Manual Entry

In the editor's **Left Sidebar → Content tab**:

1. **Add a section** — Click the "Add Section" button. Enter a section title (e.g., "Compact / Carry-Size").
2. **Add items** — Within a section, click "Add Item". Fill in:
   - **Title** (required) — The product or listing name
   - **Subtitle** — Caliber, category, or short descriptor
   - **Price** — Enter the numeric value; formatting is automatic
   - **Sale Price** — Optional discounted price
   - **Badge** — Type badge text like `NEW`, `SALE`, `USED`, or `LIMITED`
   - **Priority** — Choose from `hero`, `featured`, `normal`, or `compact`
   - **Image** — Upload a product photo via the asset manager
3. **Reorder items** — Drag items up/down within or between sections.
4. **Bulk edit** — Use the table view mode for spreadsheet-style editing of multiple items.

### CSV Import

For bulk imports, prepare a CSV file following this format:

```csv
section,title,subtitle,description,price,sale_price,badge,image,priority,tags
Compact / Carry-Size,Glock 43X MOS,9mm | Slimline,,580,520,SALE,,featured,"compact,9mm"
Range / Training,Sig Sauer P322,.22 LR | Range,,400,,,,normal,"training,22lr"
```

Then in the editor sidebar, use the **CSV Import** button to load your data. Items are grouped into sections automatically based on the `section` column.

**Tips for CSV imports:**
- Sections are created automatically from unique values in the `section` column.
- Empty fields are handled gracefully — only `section` and `title` are required.
- Quoted commas within fields are supported (e.g., `"compact,9mm"` in the tags column).
- Existing content can be merged or replaced depending on import settings.

---

## Using the Editor

The editor workspace is divided into three main areas:

### Left Sidebar

Contains multiple tabs for managing your project:

| Tab | Purpose |
|---|---|
| **Content** | Section/item list, drag-and-drop reorder, CSV import, quick add |
| **Assets** | Image library, logo uploads, backgrounds |
| **Brand** | Colors, fonts, contact info, disclaimers, style keywords |
| **Layout** | Layout family picker, density slider, variant generation |
| **AI Handoff** | Prompt preview, export mode, package options |
| **Export** | Direct PNG/PDF/SVG export controls |

### Canvas Preview

The center area shows a live preview of your flyer layout. The canvas:

- Renders at accurate proportions matching your chosen canvas size.
- Updates in real-time as you edit content, reorder items, or change layout settings.
- Shows the computed layout from the deterministic solver.
- Supports zoom to inspect details.

### Right Inspector

When you select an item or section on the canvas or in the sidebar, the right panel shows its editable properties:

- **Card size** — Normal, compact, or wide
- **Image fit** — Contain, cover, crop
- **Priority** — Promote to hero or demote to compact
- **Badge** — Edit badge text and style
- **Price display** — Override automatic formatting
- **Aspect ratio** — Preferred image dimensions

---

## Layout Generation

AdGen's layout engine generates deterministic layouts based on your content:

1. **Choose a layout family:**
   - **Inventory Board** — Dense grid with grouped sections, ideal for product catalogs
   - **Hero + Grid** — Large featured item with supporting grid, ideal for sales
   - **Menu / Listing Board** — Text-heavy layout with price columns, ideal for restaurants

2. **Adjust density** — Use the density control to switch between:
   - **Loose** — More whitespace, fewer items visible, premium feel
   - **Normal** — Balanced readability and density
   - **Dense** — Maximum items visible, compact cards

3. **Generate variants** — The engine can produce multiple layout alternatives scored by readability, balance, and content fit. Compare them and pick the best one.

4. **The engine considers:**
   - Total item count and section count
   - Hero item presence and placement
   - Image availability per item
   - Footer and disclaimer size requirements
   - Canvas aspect ratio and safe margins
   - Text length and price visibility

---

## Brand Configuration

Configure your brand identity in the **Brand tab** of the left sidebar:

| Field | Description |
|---|---|
| **Brand Name** | Your business or organization name |
| **Logo** | Upload your logo image |
| **Website** | Your website URL (displayed in footer) |
| **Phone** | Contact phone number |
| **Email** | Contact email address |
| **Default Footer** | Text displayed at the bottom of every flyer |
| **Default Disclaimer** | Legal copy (e.g., "Prices subject to change") |
| **Background Color** | Canvas background color |
| **Primary Color** | Accent color for highlights and headings |
| **Secondary Color** | Body text and secondary elements |
| **Muted Color** | Subtle text and borders |
| **Style Keywords** | Tags like "dark tactical", "premium", "industrial" — used in AI prompt generation |
| **Font Preferences** | Heading, body, and price font families |

Brand profiles are saved with the project and used to generate accurate AI prompts.

---

## Exporting Your Flyer

### PNG Export

1. In the sidebar, navigate to the **Export tab**.
2. Click **"Export PNG"**.
3. The server renders your layout at full resolution using Playwright.
4. Download the high-resolution PNG file.

### PDF Export

1. Click **"Export PDF"** in the Export tab.
2. A vector-quality PDF is generated with selectable text paths.
3. Suitable for professional printing.

### AI Handoff Package

1. Navigate to the **AI Handoff tab**.
2. Review the auto-generated prompt and negative prompt.
3. Choose your export mode:
   - **Background & Style** (recommended) — AI polishes only the visual design
   - **Full Visual Reference** — AI processes the entire layout (risk of text corruption)
4. Click **"Export Package"**.
5. Download the ZIP containing all files needed for AI generation.

---

## AI Polish Workflow

This is AdGen's signature feature — getting professional visual polish from AI while keeping every price, name, and phone number pixel-perfect.

### Step 1: Export for AI

1. Open the **AI Handoff tab**.
2. Click **"Export Package"** to download the ZIP.
3. The package contains:
   - `rough-layout.png` — The full rough layout reference
   - `rough-layout-background-only.png` — Layout with text masked out
   - `prompt.md` — Detailed instructions for the AI generator
   - `negative-prompt.txt` — Things the AI should avoid
   - `exact-text-overlay.svg` — Your exact text as a transparent layer

### Step 2: Run AI Generation

Take the files from your ZIP and upload them to your preferred AI image generator:

- **ChatGPT (GPT-4o image)** — Upload `rough-layout-background-only.png` along with the text from `prompt.md`
- **Midjourney** — Use `prompt.md` content as your prompt with the rough layout as reference
- **Adobe Firefly** — Upload the rough layout and apply the style direction
- **DALL-E** — Use the prompt with the reference image

> **Important:** Use the `rough-layout-background-only.png` (text removed) rather than the full layout. This prevents the AI from attempting to redraw text, which leads to spelling errors and artifacts.

### Step 3: Import Polished Background

1. Download the AI-generated result.
2. Back in AdGen's editor, use the **"Import Polished Background"** button.
3. Upload the AI-polished image.
4. The image is placed as the background layer, aligned to your canvas dimensions.

### Step 4: Overlay Exact Content

1. AdGen automatically overlays your exact text, prices, logos, and QR codes on top of the polished background.
2. Use the **Contrast Guard** to check text readability against the new background.
3. Adjust text shadow/stroke settings if needed for legibility.
4. Toggle individual layers (background, text, images) to fine-tune the composite.

### Step 5: Export Final Composite

1. Click **"Export Final"** to render the composite at full resolution.
2. Choose PNG for web use or PDF for print.
3. Your final flyer has AI-quality polish with 100% accurate content.

---

## Working with Validation Warnings

AdGen validates your layout in real-time and warns you about potential issues:

| Warning | What It Means | How to Fix |
|---|---|---|
| **Missing Image** | An item has no assigned product photo | Upload an image via the Assets tab |
| **Text Overflow** | Product name or description is too long for the card size | Shorten the text, increase card size, or reduce density |
| **Tiny Text** | Font size has fallen below 10px (unreadable in print) | Reduce item count or increase canvas size |
| **Overcrowding** | Too many items for the canvas size | Remove items, reduce density, or switch to a larger canvas |
| **Low Resolution** | An uploaded image would appear blurry at print size | Replace with a higher-resolution image (150+ DPI recommended) |
| **Missing Price** | A visible item has no price set | Add a price or mark the item as hidden |
| **Missing Contact** | No footer/contact block configured | Add phone, email, or website in Brand settings |
| **Legal/Compliance** | Disclaimer text is missing or overflowing | Shorten disclaimer or increase footer space |
| **Low Contrast** | Text overlay may be hard to read against the background | Enable text shadow/stroke or adjust colors |

---

## Tips & Best Practices

1. **Start with CSV for large catalogs.** Manual entry works for a few items, but CSV import saves hours when you have 20+ products.

2. **Use the "Background & Style" AI mode.** This is the safest option — the AI only changes visual styling while AdGen handles all text. Use "Full Visual Reference" only for quick concepts where exact text doesn't matter.

3. **Set hero items deliberately.** Promoting one item to `hero` priority gives it a larger card and prominent placement. Use this for your most important product or headline deal.

4. **Check validation before exporting.** Always review warnings in the bottom panel. Text overflow and tiny text are the most common issues with dense layouts.

5. **Save brand profiles.** If you create flyers for the same business regularly, configure the brand once and reuse it across projects.

6. **Test with the seeded project first.** The CFC Tactical Handgun Board demonstrates all features with realistic data. Use it to learn the workflow before creating your own projects.

7. **Use Prisma Studio for debugging.** Run `npx prisma studio` to visually inspect and edit database records when troubleshooting.
