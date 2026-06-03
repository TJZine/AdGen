import { z } from 'zod';
import type { Asset as PrismaAsset } from '@prisma/client';

// ==========================================
// 1. Canvas Preset Schema
// ==========================================
export const CanvasPresetSchema = z.object({
  id: z.string().uuid().or(z.string()),
  name: z.string().min(1, 'Preset name is required'),
  widthPx: z.number().int().positive('Width must be a positive integer').min(500, 'Width must be at least 500 pixels'),
  heightPx: z.number().int().positive('Height must be a positive integer').min(500, 'Height must be at least 500 pixels'),
  dpi: z.number().int().positive().default(300),
  safeMarginPx: z.number().int().nonnegative().default(120),
  unit: z.enum(['in', 'px', 'mm']).default('in'),
});

export type CanvasPreset = z.infer<typeof CanvasPresetSchema>;

// ==========================================
// 2. Brand Profile Schema
// ==========================================
export const BrandColorsSchema = z.object({
  background: z
    .string()
    .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/, 'Must be a valid hex color')
    .default('#FFFFFF'),
  primary: z
    .string()
    .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/, 'Must be a valid hex color')
    .default('#000000'),
  secondary: z
    .string()
    .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/, 'Must be a valid hex color')
    .default('#666666'),
  muted: z
    .string()
    .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/, 'Must be a valid hex color')
    .default('#CCCCCC'),
});

export type BrandColors = z.infer<typeof BrandColorsSchema>;

export const FontPreferencesSchema = z.object({
  heading: z.string().default('Inter'),
  body: z.string().default('Inter'),
  price: z.string().default('Inter'),
});

export type FontPreferences = z.infer<typeof FontPreferencesSchema>;

export const BrandProfileSchema = z.object({
  id: z.string().uuid().or(z.string()),
  brandName: z.string().min(1, 'Brand name is required'),
  logoAssetId: z.string().nullable().default(null),
  website: z.string().url().or(z.literal('')).default(''),
  phone: z.string().default(''),
  email: z.string().email().or(z.literal('')).default(''),
  defaultFooter: z.string().default(''),
  defaultDisclaimer: z.string().default(''),
  colors: BrandColorsSchema.default({
    background: '#FFFFFF',
    primary: '#000000',
    secondary: '#666666',
    muted: '#CCCCCC',
  }),
  styleKeywords: z.array(z.string()).default([]),
  fontPreferences: FontPreferencesSchema.default({
    heading: 'Inter',
    body: 'Inter',
    price: 'Inter',
  }),
});

export type BrandProfile = z.infer<typeof BrandProfileSchema>;

// ==========================================
// 3. Asset Schema
// ==========================================
export const AssetTypeSchema = z.enum(['image', 'logo', 'font']);
export type AssetType = z.infer<typeof AssetTypeSchema>;

export const AssetSchema = z.object({
  id: z.string().uuid().or(z.string()),
  name: z.string().min(1, 'Asset name is required'),
  type: AssetTypeSchema,
  filePath: z.string(), // Local filepath or relative URL
  thumbnailPath: z.string().nullable().default(null),
  mimeType: z.string(),
  sizeBytes: z.number().int().positive(),
  dimensions: z
    .object({
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    })
    .nullable()
    .default(null),
  focalPoint: z
    .object({
      x: z.number().min(0).max(1), // Normalized X (0 to 1) for responsive crops
      y: z.number().min(0).max(1), // Normalized Y (0 to 1)
    })
    .default({ x: 0.5, y: 0.5 }),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Asset = z.infer<typeof AssetSchema>;

export function mapPrismaAssetToZod(dbAsset: PrismaAsset): Asset {
  return {
    id: dbAsset.id,
    name: dbAsset.name,
    type: (['image', 'logo', 'font'].includes(dbAsset.type) ? dbAsset.type : 'image') as AssetType,
    filePath: dbAsset.filePath,
    thumbnailPath: null,
    mimeType: dbAsset.mimeType,
    sizeBytes: dbAsset.sizeBytes,
    dimensions: dbAsset.width && dbAsset.height 
      ? { width: dbAsset.width, height: dbAsset.height } 
      : null,
    focalPoint: {
      x: dbAsset.focalPointX,
      y: dbAsset.focalPointY,
    },
    createdAt: dbAsset.createdAt.toISOString(),
    updatedAt: dbAsset.updatedAt.toISOString(),
  };
}

// ==========================================
// 4. Item Schema
// ==========================================
export const ItemPrioritySchema = z.enum([
  'hero',
  'featured',
  'normal',
  'compact',
]);
export type ItemPriority = z.infer<typeof ItemPrioritySchema>;

export const VisibilityModeSchema = z.enum(['visible', 'hidden']);
export type VisibilityMode = z.infer<typeof VisibilityModeSchema>;

export const ImageFitModeSchema = z.enum([
  'contain',
  'cover',
  'crop',
  'transparent',
  'full_bleed',
]);
export type ImageFitMode = z.infer<typeof ImageFitModeSchema>;

export const LayoutHintsSchema = z.object({
  cardSize: z.enum(['normal', 'compact', 'wide']).default('normal'),
  imageFit: ImageFitModeSchema.default('contain'),
  preferredAspectRatio: z.string().default('4:3'), // "4:3", "1:1", "16:9"
});
export type LayoutHints = z.infer<typeof LayoutHintsSchema>;

export const ItemSchema = z.object({
  id: z.string().uuid().or(z.string()),
  sectionId: z.string(),
  title: z.string().min(1, 'Item title is required'),
  subtitle: z.string().default(''),
  description: z.string().default(''),
  price: z.number().nullable().default(null),
  priceDisplay: z.string().default(''), // Custom override formatting e.g. "$530", "From $20/hr"
  salePrice: z.number().nullable().default(null),
  badge: z.string().nullable().default(null), // e.g. "SALE", "USED", "NEW"
  imageAssetId: z.string().nullable().default(null),
  priority: ItemPrioritySchema.default('normal'),
  visibility: VisibilityModeSchema.default('visible'),
  layoutHints: LayoutHintsSchema.default({
    cardSize: 'normal',
    imageFit: 'contain',
    preferredAspectRatio: '4:3',
  }),
  focalPoint: z
    .object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
    })
    .optional(),
  metadata: z.record(z.string(), z.any()).default({ tags: [] }),
});

export type Item = z.infer<typeof ItemSchema>;

// ==========================================
// 5. Section Schema
// ==========================================
export const SectionPrioritySchema = z.enum(['high', 'normal', 'low']);
export type SectionPriority = z.infer<typeof SectionPrioritySchema>;

export const SectionLayoutHintSchema = z.enum([
  'grid',
  'list',
  'featured_hero',
]);
export type SectionLayoutHint = z.infer<typeof SectionLayoutHintSchema>;

export const SectionSchema = z.object({
  id: z.string().uuid().or(z.string()),
  title: z.string().min(1, 'Section title is required'),
  subtitle: z.string().default(''),
  priority: SectionPrioritySchema.default('normal'),
  layoutHint: SectionLayoutHintSchema.default('grid'),
  order: z.number().int().nonnegative(),
  items: z.array(ItemSchema).default([]),
});

export type Section = z.infer<typeof SectionSchema>;

// ==========================================
// 6. Layout Element Schema
// ==========================================
export const ElementTypeSchema = z.enum([
  'text',
  'image',
  'item_card',
  'section_header',
  'price',
  'badge',
  'shape',
  'qr_code',
  'footer',
  'group',
  'background',
  'ai_instruction_zone',
]);
export type ElementType = z.infer<typeof ElementTypeSchema>;

export const LayoutStyleSchema = z.object({
  variant: z.string().optional(), // "image_left_text_right" | "image_top_text_bottom" | etc.
  density: z.enum(['loose', 'normal', 'dense']).optional(),
  border: z.boolean().optional(),
  pricePosition: z.enum(['bottom_right', 'top_right', 'inline']).optional(),
  fontFamily: z.string().optional(),
  fontSize: z.number().optional(),
  color: z.string().optional(),
  fontWeight: z.string().optional(),
  textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
  backgroundColor: z.string().optional(),
  opacity: z.number().min(0).max(1).optional(),
});
export type LayoutStyle = z.infer<typeof LayoutStyleSchema>;

export const LayoutElementSchema = z.object({
  id: z.string(),
  type: ElementTypeSchema,
  contentRef: z.string(), // Links to item.id, section.id, or brand field
  x: z.number(), // Absolute X on canvas (pixels)
  y: z.number(), // Absolute Y on canvas (pixels)
  width: z.number().positive(),
  height: z.number().positive(),
  locked: z.boolean().default(false),
  style: LayoutStyleSchema.default({}),
});

export type LayoutElement = z.infer<typeof LayoutElementSchema>;

// ==========================================
// 7. Project Schema
// ==========================================
// ==========================================
// 7. Project Schema
// ==========================================
export const PolishedBackgroundSchema = z.object({
  assetId: z.string().nullable().default(null),
  fitMode: z.enum(['cover', 'contain', 'stretch']).default('cover'),
  offsetX: z.number().default(0),
  offsetY: z.number().default(0),
  scale: z.number().default(1),
  opacity: z.number().min(0).max(1).default(1),
  legibilityPreset: z.enum(['none', 'backing_plate', 'drop_shadow', 'text_outline']).default('none'),
});

export type PolishedBackground = z.infer<typeof PolishedBackgroundSchema>;

export const LayoutVariantSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  layoutFamily: z.string(),
  density: z.enum(['loose', 'normal', 'dense']),
  elements: z.array(LayoutElementSchema),
  score: z.number().min(0).max(100),
  warnings: z.array(z.string()),
  polishedBackground: PolishedBackgroundSchema.optional(),
});

export type LayoutVariant = z.infer<typeof LayoutVariantSchema>;

const ProjectBaseSchema = z.object({
  schemaVersion: z.string().default('1.0.0'),
  id: z.string().uuid().or(z.string()),
  name: z.string().min(1, 'Project name is required'),
  type: z.string().default('inventory_board'),
  canvas: CanvasPresetSchema,
  brand: BrandProfileSchema,
  content: z.object({
    headline: z.string().default(''),
    subheadline: z.string().default(''),
    sections: z.array(SectionSchema).default([]),
  }),
  layout: z.object({
    elements: z.array(LayoutElementSchema).default([]),
    layoutFamily: z.string(), // "inventory_board", "hero_grid", "menu_listing"
    density: z.enum(['loose', 'normal', 'dense']).default('normal'),
    score: z.number().min(0).max(100).default(100),
    warnings: z.array(z.string()).default([]),
  }),
  exportSettings: z.object({
    exactTextOverlay: z.boolean().default(true),
    aiPolishMode: z
      .enum(['background_and_style', 'full_visual_reference'])
      .default('background_and_style'),
    finalFormats: z
      .array(z.enum(['png', 'pdf', 'svg']))
      .default(['png', 'pdf']),
  }),
  polishedBackground: PolishedBackgroundSchema.default({
    assetId: null,
    fitMode: 'cover',
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    opacity: 1,
    legibilityPreset: 'none',
  }),
  createdAt: z
    .string()
    .datetime()
    .default(() => new Date().toISOString()),
  updatedAt: z
    .string()
    .datetime()
    .default(() => new Date().toISOString()),
  layoutVariants: z.array(LayoutVariantSchema).default([]),
  activeVariantId: z.string().uuid().nullable().default(null),
});

function generateUUID(): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const ProjectSchema = z.preprocess((val: unknown) => {
  if (val && typeof val === 'object') {
    const migrated = { ...(val as Record<string, unknown>) };
    if ('variants' in migrated && migrated['variants'] && typeof migrated['variants'] === 'object' && !migrated['layoutVariants']) {
      const layoutVariants: unknown[] = [];
      let newActiveVariantId: string | null = null;
      const keyToUuidMap = new Map<string, string>();
      const variants = migrated['variants'] as Record<string, unknown>;

      // First generate UUIDs and map them
      for (const key of Object.keys(variants)) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);
        const uuid = isUuid ? key : generateUUID();
        keyToUuidMap.set(key, uuid);
      }

      for (const [key, variantProj] of Object.entries(variants)) {
        if (variantProj && typeof variantProj === 'object') {
          const vProj = variantProj as Record<string, unknown>;
          const uuid = keyToUuidMap.get(key)!;
          
          const name = (vProj['name'] as string | undefined) || key || 'Unnamed Variant';
          
          const vProjLayout = (vProj['layout'] && typeof vProj['layout'] === 'object') ? (vProj['layout'] as Record<string, unknown>) : null;
          const migratedLayout = (migrated['layout'] && typeof migrated['layout'] === 'object') ? (migrated['layout'] as Record<string, unknown>) : null;

          const layoutFamily = (vProjLayout?.['layoutFamily'] as string | undefined) || (migratedLayout?.['layoutFamily'] as string | undefined) || 'inventory_board';
          const density = (vProjLayout?.['density'] as string | undefined) || (migratedLayout?.['density'] as string | undefined) || 'normal';
          const elements = (vProjLayout?.['elements'] as unknown[] | undefined) || (migratedLayout?.['elements'] as unknown[] | undefined) || [];
          const score = typeof vProjLayout?.['score'] === 'number' ? vProjLayout['score'] : ((migratedLayout?.['score'] as number | undefined) ?? 100);
          const warnings = (vProjLayout?.['warnings'] as string[] | undefined) || (migratedLayout?.['warnings'] as string[] | undefined) || [];
          const polishedBackground = vProj['polishedBackground'] || migrated['polishedBackground'];

          layoutVariants.push({
            id: uuid,
            name,
            layoutFamily,
            density,
            elements,
            score,
            warnings,
            polishedBackground,
          });
        }
      }

      migrated['layoutVariants'] = layoutVariants;
      
      const oldActiveId = migrated['activeVariantId'];
      if (typeof oldActiveId === 'string') {
        if (keyToUuidMap.has(oldActiveId)) {
          newActiveVariantId = keyToUuidMap.get(oldActiveId)!;
        } else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(oldActiveId)) {
          newActiveVariantId = oldActiveId;
        }
      }
      migrated['activeVariantId'] = newActiveVariantId;
      
      delete migrated['variants'];
    }
    return migrated;
  }
  return val;
}, ProjectBaseSchema);

export type Project = z.infer<typeof ProjectSchema>;

// ==========================================
// 8. Template Schema
// ==========================================
export const TemplateSchema = z.object({
  schemaVersion: z.string().default('1.0.0'),
  id: z.string().uuid().or(z.string()),
  name: z.string(),
  description: z.string().default(''),
  category: z.string().default('general'),
  layoutFamily: z.string(),
  canvasPreset: CanvasPresetSchema,
  isSystem: z.boolean().default(false),
  brandProfileOverride: BrandProfileSchema.partial().optional(),
  defaultLayoutSettings: z
    .object({
      density: z.enum(['loose', 'normal', 'dense']).default('normal'),
      exactTextOverlay: z.boolean().default(true),
      aiPolishMode: z
        .enum(['background_and_style', 'full_visual_reference'])
        .default('background_and_style'),
    })
    .default({
      density: 'normal',
      exactTextOverlay: true,
      aiPolishMode: 'background_and_style',
    }),
  createdAt: z
    .string()
    .datetime()
    .default(() => new Date().toISOString()),
  updatedAt: z
    .string()
    .datetime()
    .default(() => new Date().toISOString()),
});

export type Template = z.infer<typeof TemplateSchema>;

// ==========================================
// 9. Export Package Schema (Manifest)
// ==========================================
export const ExportPackageManifestSchema = z.object({
  schemaVersion: z.string().default('1.0.0'),
  projectId: z.string(),
  projectName: z.string(),
  exportId: z.string().uuid(),
  timestamp: z.string().datetime(),
  layoutFamily: z.string(),
  canvas: CanvasPresetSchema,
  brand: BrandProfileSchema,
  aiPolishMode: z.enum(['background_and_style', 'full_visual_reference']),
  files: z.object({
    manifest: z.string(),
    readme: z.string(),
    prompt: z.string(),
    negativePrompt: z.string(),
    roughLayout: z.string(),
    backgroundOnly: z.string().optional(),
    textOverlaySvg: z.string(),
    textOverlayPng: z.string(),
    projectJson: z.string(),
    assetsDir: z.string(),
  }),
  assets: z.array(
    z.object({
      assetId: z.string(),
      originalName: z.string(),
      filePathInZip: z.string(),
    })
  ),
  overlayCoordinates: z.array(LayoutElementSchema),
});

export type ExportPackageManifest = z.infer<typeof ExportPackageManifestSchema>;

// ==========================================
// 10. Validation Model Schema
// ==========================================
export const ValidationErrorTypeSchema = z.enum([
  'tiny_text',
  'text_overflow',
  'overcrowding',
  'low_resolution',
  'missing_field',
  'compliance_missing',
]);
export type ValidationErrorType = z.infer<typeof ValidationErrorTypeSchema>;

export const ValidationErrorSchema = z.object({
  id: z.string(),
  type: ValidationErrorTypeSchema,
  severity: z.enum(['warning', 'error']),
  message: z.string(),
  elementId: z.string().optional(),
  field: z.string().optional(),
  fixSuggestion: z.string().optional(),
});

export type ValidationError = z.infer<typeof ValidationErrorSchema>;

export const ValidationResultSchema = z.object({
  status: z.enum(['success', 'warning', 'error']),
  errors: z.array(ValidationErrorSchema).default([]),
  score: z.number().min(0).max(100).default(100),
  validatedAt: z.string().datetime(),
  metrics: z.object({
    totalItems: z.number(),
    visibleItems: z.number(),
    totalSections: z.number(),
    averageFontSize: z.number(),
    minFontSize: z.number(),
    whitespaceRatio: z.number(),
    hasFooter: z.boolean(),
    hasDisclaimer: z.boolean(),
  }),
});

export type ValidationResult = z.infer<typeof ValidationResultSchema>;
