# Schema Plan

This document establishes the TypeScript models and JSON structures that serve as the single source of truth for the application.

## Core Models

### 1. Canvas Preset Schema

Defines the dimensions, DPI, and safe boundaries for deterministic rendering.

```typescript
export interface CanvasPreset {
  id: string;
  name: string;
  widthPx: number;
  heightPx: number;
  dpi: number;
  safeMarginPx: number;
  unit: 'in' | 'px' | 'mm';
}
```

### 2. Brand Profile Schema

Captures styling keywords, colors, logo references, contact details, and compliance configurations.

```typescript
export interface BrandColors {
  background: string;
  primary: string;
  secondary: string;
  muted: string;
}

export interface FontPreferences {
  heading: string;
  body: string;
  price: string;
}

export interface BrandProfile {
  id: string;
  brandName: string;
  logoAssetId: string | null;
  website: string;
  phone: string;
  email: string;
  defaultFooter: string;
  defaultDisclaimer: string;
  colors: BrandColors;
  styleKeywords: string[];
  fontPreferences: FontPreferences;
}
```

### 3. Section Schema

Sections allow items to be grouped together logically.

```typescript
export type SectionPriority = 'high' | 'normal' | 'low';
export type SectionLayoutHint = 'grid' | 'list' | 'featured_hero';

export interface Section {
  id: string;
  title: string;
  subtitle: string;
  priority: SectionPriority;
  layoutHint: SectionLayoutHint;
  order: number;
  items: Item[];
}
```

### 4. Item Schema

The atomic data model for products, events, packages, or listings.

```typescript
export type ItemPriority = 'hero' | 'featured' | 'normal' | 'compact';
export type VisibilityMode = 'visible' | 'hidden';
export type ImageFitMode =
  | 'contain'
  | 'cover'
  | 'crop'
  | 'transparent'
  | 'full_bleed';

export interface LayoutHints {
  cardSize: 'normal' | 'compact' | 'wide';
  imageFit: ImageFitMode;
  preferredAspectRatio: string; // e.g. "4:3", "1:1", "16:9"
}

export interface Item {
  id: string;
  sectionId: string;
  title: string;
  subtitle: string;
  description: string;
  price: number | null;
  priceDisplay: string; // Formatting override, e.g. "$530", "From $20/hr"
  salePrice: number | null;
  badge: string | null; // e.g. "SALE", "USED", "NEW"
  imageAssetId: string | null;
  priority: ItemPriority;
  visibility: VisibilityMode;
  layoutHints: LayoutHints;
  metadata: {
    tags: string[];
    [key: string]: any;
  };
}
```

### 5. Layout Element Schema

Produced by the layout engine, this model represents positioned boxes.

```typescript
export type ElementType =
  | 'text'
  | 'image'
  | 'item_card'
  | 'section_header'
  | 'price'
  | 'badge'
  | 'shape'
  | 'qr_code'
  | 'footer'
  | 'group'
  | 'background'
  | 'ai_instruction_zone';

export interface LayoutStyle {
  variant?:
    | 'image_left_text_right'
    | 'image_top_text_bottom'
    | 'compact_row'
    | 'hero_wide'
    | string;
  density?: 'loose' | 'normal' | 'dense';
  border?: boolean;
  pricePosition?: 'bottom_right' | 'top_right' | 'inline';
  fontFamily?: string;
  fontSize?: number;
  color?: string;
}

export interface LayoutElement {
  id: string;
  type: ElementType;
  contentRef: string; // Maps to item.id, section.id, or brand fields
  x: number;
  y: number;
  width: number;
  height: number;
  locked: boolean;
  style: LayoutStyle;
}
```

### 6. Project Schema

The root document combining content and layout.

```typescript
export interface Project {
  id: string;
  name: string;
  type: 'inventory_board' | 'hero_grid' | 'menu_listing' | string;
  canvas: CanvasPreset;
  brand: BrandProfile;
  content: {
    headline: string;
    subheadline: string;
    sections: Section[];
  };
  layout: {
    elements: LayoutElement[];
    layoutFamily: string;
    density: 'loose' | 'normal' | 'dense';
    score: number;
    warnings: string[];
  };
  exportSettings: {
    exactTextOverlay: boolean;
    aiPolishMode: 'background_and_style' | 'full_visual_reference';
    finalFormats: ('png' | 'pdf' | 'svg')[];
  };
  createdAt: string;
  updatedAt: string;
}
```
