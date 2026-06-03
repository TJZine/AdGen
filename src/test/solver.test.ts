import { describe, it, expect } from 'vitest';
import { solveLayout } from '../lib/layout/solver';
import { Project, SectionPriority, CanvasPresetSchema, LayoutVariant } from '../lib/schemas/project';
import { evaluateLayout } from '../lib/validation/rules';

function createMockProject(itemCount: number, sectionPriorities: string[] = ['normal']): Project {
  const sections = sectionPriorities.map((priority, sIdx) => {
    const sectionItems = [];
    const itemsPerSection = Math.ceil(itemCount / sectionPriorities.length);
    const startIdx = sIdx * itemsPerSection;
    const endIdx = Math.min(itemCount, startIdx + itemsPerSection);

    for (let i = startIdx; i < endIdx; i++) {
      sectionItems.push({
        id: `item-${i}`,
        sectionId: `sec-${sIdx}`,
        title: `Mock Item Title ${i}`,
        subtitle: `Subtitle ${i}`,
        description: `This is a mock description for item ${i} to test text wrapping and scaling heuristics.`,
        price: 500 + i,
        priceDisplay: `$${500 + i}`,
        salePrice: null,
        badge: i % 3 === 0 ? 'NEW' : null,
        imageAssetId: i % 2 === 0 ? 'asset-mock-image' : null,
        priority: 'normal' as const,
        visibility: 'visible' as const,
        layoutHints: {
          cardSize: 'normal' as const,
          imageFit: 'contain' as const,
          preferredAspectRatio: '4:3',
        },
        metadata: { tags: ['mock'] },
      });
    }

    return {
      id: `sec-${sIdx}`,
      title: `Section ${sIdx}`,
      subtitle: `Subtitle for Section ${sIdx}`,
      priority: priority as SectionPriority,
      layoutHint: 'grid' as const,
      order: sIdx,
      items: sectionItems,
    };
  });

  return {
    schemaVersion: '1.0.0',
    id: 'mock-project-id',
    name: 'Mock Testing Project',
    type: 'inventory_board',
    canvas: {
      id: 'poster_11x17',
      name: 'Poster 11x17',
      widthPx: 3300,
      heightPx: 5100,
      dpi: 300,
      safeMarginPx: 120,
      unit: 'in',
    },
    brand: {
      id: 'mock-brand',
      brandName: 'Mock Brand',
      logoAssetId: null,
      website: 'https://mockbrand.com',
      phone: '123-456-7890',
      email: 'info@mockbrand.com',
      defaultFooter: 'Mock Footer Message',
      defaultDisclaimer: 'Mock Disclaimer Text',
      colors: {
        background: '#181818',
        primary: '#ff6a00',
        secondary: '#ffffff',
        muted: '#a0a0a0',
      },
      styleKeywords: ['clean', 'modern'],
      fontPreferences: {
        heading: 'Inter',
        body: 'Inter',
        price: 'Inter',
      },
    },
    content: {
      headline: 'Mock Inventory Board',
      subheadline: 'Testing the HGP solver performance',
      sections,
    },
    layout: {
      elements: [],
      layoutFamily: 'inventory_board',
      density: 'normal',
      score: 100,
      warnings: [],
    },
    exportSettings: {
      exactTextOverlay: true,
      aiPolishMode: 'background_and_style',
      finalFormats: ['png', 'pdf'],
    },
    polishedBackground: {
      assetId: null,
      fitMode: 'cover',
      offsetX: 0,
      offsetY: 0,
      scale: 1,
      opacity: 1,
      legibilityPreset: 'none',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    layoutVariants: [],
    activeVariantId: null,
  };
}

describe('HGP Layout Solver', () => {
  const itemCounts = [1, 6, 12, 24];

  itemCounts.forEach((count) => {
    it(`should run without overlapping item cards for ${count} items`, () => {
      const project = createMockProject(count);
      const result = solveLayout(project);

      expect(result.elements).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);

      // Filter for item_card types
      const cards = result.elements.filter((el) => el.type === 'item_card');
      expect(cards.length).toBe(count);

      // Assert zero overlap between any two cards
      for (let i = 0; i < cards.length; i++) {
        for (let j = i + 1; j < cards.length; j++) {
          const a = cards[i];
          const b = cards[j];

          const overlaps =
            a.x < b.x + b.width &&
            a.x + a.width > b.x &&
            a.y < b.y + b.height &&
            a.y + a.height > b.y;

          expect(overlaps).toBe(false);
        }
      }
    });
  });

  it('should handle section priority weights correctly', () => {
    // Create 2 sections: sec-0 (high priority) and sec-1 (low priority)
    // with 2 items in each section
    const project = createMockProject(4, ['high', 'low']);
    const result = solveLayout(project);

    const sec0Header = result.elements.find(el => el.id === 'section-header-sec-0');
    const sec1Header = result.elements.find(el => el.id === 'section-header-sec-1');
    const sec0Cards = result.elements.filter(
      el => el.type === 'item_card' && el.contentRef.startsWith('item-') && ['item-0', 'item-1'].includes(el.contentRef)
    );
    const sec1Cards = result.elements.filter(
      el => el.type === 'item_card' && el.contentRef.startsWith('item-') && ['item-2', 'item-3'].includes(el.contentRef)
    );

    expect(sec0Header).toBeDefined();
    expect(sec1Header).toBeDefined();
    expect(sec0Cards.length).toBe(2);
    expect(sec1Cards.length).toBe(2);

    // High priority cards should be vertically taller than low priority cards
    const card0Height = sec0Cards[0].height;
    const card1Height = sec1Cards[0].height;
    expect(card0Height).toBeGreaterThan(card1Height);
  });

  it('should enforce CanvasPreset minimum bounds of 500px', () => {
    const invalidPreset = {
      id: 'custom_preset',
      name: 'Invalid Small Preset',
      widthPx: 499,
      heightPx: 500,
      dpi: 300,
      safeMarginPx: 120,
      unit: 'in' as const,
    };
    const result = CanvasPresetSchema.safeParse(invalidPreset);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('Width must be at least 500 pixels');
    }
  });

  it('should flag out of bounds elements and deduct score', () => {
    const mockElements = [
      {
        id: 'out-el-1',
        type: 'text' as const,
        contentRef: 'headline',
        x: -10,
        y: 50,
        width: 100,
        height: 50,
        locked: false,
        style: {},
      },
      {
        id: 'out-el-2',
        type: 'image' as const,
        contentRef: 'image-1',
        x: 950,
        y: 50,
        width: 100,
        height: 50,
        locked: false,
        style: {},
      }
    ];
    
    const evalResult = evaluateLayout(mockElements, [], [], 900, 1000);
    expect(evalResult.score).toBe(80); // 100 - 20 (10 points per out of bounds element)
    expect(evalResult.warnings.length).toBe(2);
    expect(evalResult.warnings[0]).toContain('out-el-1');
    expect(evalResult.warnings[1]).toContain('out-el-2');
  });

  it('should flag tiny text at exactly 10px if truncated', () => {
    const textFitResults = [
      { text: 'This text is truncated and tiny', fontSize: 10, isTruncated: true },
      { text: 'This text is truncated but not tiny', fontSize: 14, isTruncated: true },
      { text: 'This text is tiny but not truncated', fontSize: 10, isTruncated: false },
    ];
    
    const evalResult = evaluateLayout([], [], textFitResults, 1000, 1000);
    // Deducts:
    // - 1st item: 10px and truncated -> tiny text deduction (5) + truncation deduction (3) = 8
    // - 2nd item: 14px and truncated -> truncation deduction (3) = 3
    // - 3rd item: 10px but NOT truncated -> no deduction (0)
    // Total deduction: 11. Final score: 89
    expect(evalResult.score).toBe(89);
    expect(evalResult.warnings.length).toBe(3); // 1 tiny text warning, 2 truncation warnings
  });

  it('should dynamically clamp vertical section gaps if they exceed 20% of main height', () => {
    const project = createMockProject(5, ['normal', 'normal', 'normal', 'normal', 'normal']);
    project.canvas = {
      id: 'custom_small',
      name: 'Small Canvas',
      widthPx: 600,
      heightPx: 600,
      dpi: 300,
      safeMarginPx: 20,
      unit: 'px' as const,
    };
    project.brand.website = '';
    
    const result = solveLayout(project);
    
    const sec0Header = result.elements.find(el => el.id === 'section-header-sec-0')!;
    const sec1Header = result.elements.find(el => el.id === 'section-header-sec-1')!;
    
    // safeHeight = 600 - 40 = 560
    // headerHeight = max(150, 560 * 0.08) = 150
    // footerHeight = max(100, 560 * 0.06) = 100
    // mainHeight = 560 - 150 - 100 = 310
    // 20% of mainHeight = 62
    // Normal gaps would be 4 * 30 = 120 > 62
    // Clamped gap = 62 / 4 = 15.5
    // Section heights = (1 / 5) * (310 - 4 * 15.5) = 49.6
    // sec1Header.y - sec0Header.y = sectionHeight + gap = 49.6 + 15.5 = 65.1
    const distance = sec1Header.y - sec0Header.y;
    expect(distance).toBeLessThan(67);
    expect(distance).toBeGreaterThan(63);
  });

  it('should respect locked layout elements coordinates and styles', () => {
    const project = createMockProject(1);
    
    const initialResult = solveLayout(project);
    const firstElement = initialResult.elements[0];
    expect(firstElement.locked).toBe(false);

    const customX = 99;
    const customY = 88;
    const customWidth = 333;
    const customHeight = 222;
    
    project.layout.elements = [
      {
        ...firstElement,
        x: customX,
        y: customY,
        width: customWidth,
        height: customHeight,
        locked: true,
        style: {
          ...firstElement.style,
          color: '#ffffff',
        },
      },
    ];

    const secondResult = solveLayout(project);
    const solvedElement = secondResult.elements.find(el => el.id === firstElement.id);
    
    expect(solvedElement).toBeDefined();
    expect(solvedElement!.x).toBe(customX);
    expect(solvedElement!.y).toBe(customY);
    expect(solvedElement!.width).toBe(customWidth);
    expect(solvedElement!.height).toBe(customHeight);
    expect(solvedElement!.locked).toBe(true);
    expect(solvedElement!.style.color).toBe('#ffffff');
  });

  it('should verify that solving for Variant A does not affect the coordinates of Variant B', () => {
    const project = createMockProject(3);

    // Create Variant A (hero_grid)
    const variantA: LayoutVariant = {
      id: 'variant-a-uuid',
      name: 'Variant A',
      layoutFamily: 'hero_grid',
      density: 'normal',
      elements: [],
      score: 100,
      warnings: [],
    };

    // Create Variant B (menu_listing)
    const variantB: LayoutVariant = {
      id: 'variant-b-uuid',
      name: 'Variant B',
      layoutFamily: 'menu_listing',
      density: 'normal',
      elements: [],
      score: 100,
      warnings: [],
    };

    // Solve for Variant A
    const resultA = solveLayout(project, variantA);
    
    // Solve for Variant B
    const resultB = solveLayout(project, variantB);

    // Verify coordinates/elements are solved and are different/independent
    expect(resultA.elements.length).toBeGreaterThan(0);
    expect(resultB.elements.length).toBeGreaterThan(0);

    // Let's find item-title-item-0 element in both results and check they differ
    const titleA = resultA.elements.find(el => el.id === 'item-title-item-0');
    const titleB = resultB.elements.find(el => el.id === 'item-title-item-0');

    expect(titleA).toBeDefined();
    expect(titleB).toBeDefined();

    // Since they use different layout families, their positioning coordinates should be different
    expect(titleA!.x).not.toEqual(titleB!.x);
    expect(titleA!.y).not.toEqual(titleB!.y);
  });
});
