import { Project, LayoutElement, Item, Section } from '../schemas/project';
import { fitText } from './textFit';
import { evaluateLayout } from '../validation/rules';

/**
 * Solve layout calculations for the AdGen flyer using layout-family-specific solver functions.
 */
export function solveLayout(project: Project): { elements: LayoutElement[]; score: number; warnings: string[] } {
  const elements: LayoutElement[] = [];

  const resolveElement = (el: LayoutElement): LayoutElement => {
    const existing = project.layout?.elements?.find((x) => x.id === el.id);
    if (existing && existing.locked) {
      return {
        ...el,
        x: existing.x,
        y: existing.y,
        width: existing.width,
        height: existing.height,
        locked: true,
        style: {
          ...el.style,
          ...existing.style,
        },
      };
    }
    return el;
  };

  const originalPush = elements.push.bind(elements);
  elements.push = (...items: LayoutElement[]): number => {
    const resolved = items.map(resolveElement);
    return originalPush(...resolved);
  };

  const textFitResults: Array<{ text: string; fontSize: number; isTruncated: boolean }> = [];
  const cardsToEvaluate: Array<{ sectionTitle: string; width: number; height: number }> = [];

  const family = project.layout?.layoutFamily || 'inventory_board';

  switch (family) {
    case 'hero_grid':
      solveHeroGrid(project, elements, textFitResults, cardsToEvaluate);
      break;
    case 'menu_listing':
      solveMenuListing(project, elements, textFitResults, cardsToEvaluate);
      break;
    case 'comparison_chart':
      solveComparisonChart(project, elements, textFitResults, cardsToEvaluate);
      break;
    case 'social_carousel':
      solveSocialCarousel(project, elements, textFitResults, cardsToEvaluate);
      break;
    case 'inventory_board':
    default:
      solveInventoryBoard(project, elements, textFitResults, cardsToEvaluate);
      break;
  }

  // Determine total bounds width (multiple pages for social carousel)
  const numSlides = family === 'social_carousel' ? calculateSocialCarouselSlides(project) : 1;

  // Evaluate score and constraints
  const { score, warnings } = evaluateLayout(
    elements,
    cardsToEvaluate,
    textFitResults,
    project.canvas.widthPx * numSlides,
    project.canvas.heightPx
  );

  return {
    elements,
    score,
    warnings,
  };
}

/**
 * Dynamically suggests the layout family based on item count and image availability.
 */
export function autoSuggestLayout(project: Project): string {
  const visibleItems = project.content.sections
    .flatMap((s) => s.items)
    .filter((item) => item.visibility !== 'hidden');
  const count = visibleItems.length;

  const itemsWithImages = visibleItems.filter((item) => !!item.imageAssetId).length;
  const imageRatio = count > 0 ? itemsWithImages / count : 0;

  // Less than 30% images -> suggest menu_listing
  if (count > 0 && imageRatio < 0.3) {
    return 'menu_listing';
  }

  if (count <= 1) {
    return 'hero_grid';
  } else if (count >= 2 && count <= 4) {
    return 'hero_grid';
  } else if (count >= 5 && count <= 20) {
    return 'inventory_board';
  } else {
    return 'inventory_board';
  }
}

/**
 * Calculates total slides for social_carousel.
 */
function calculateSocialCarouselSlides(project: Project): number {
  const visibleSections = project.content.sections.filter(
    (s) => s.items && s.items.some((item) => item.visibility !== 'hidden')
  );
  let contentSlidesCount = 0;
  visibleSections.forEach((section) => {
    const visibleItems = section.items.filter((item) => item.visibility !== 'hidden');
    contentSlidesCount += Math.ceil(visibleItems.length / 4);
  });
  return 1 + contentSlidesCount + 1; // Headline slide + content slides + Closing slide
}

/**
 * Reusable utility to render an item card and its elements.
 */
function renderItemCard(
  item: Item,
  cardX: number,
  cardY: number,
  cardWidth: number,
  cardHeight: number,
  density: 'loose' | 'normal' | 'dense',
  border: boolean,
  elements: LayoutElement[],
  textFitResults: Array<{ text: string; fontSize: number; isTruncated: boolean }>,
  brand: Project['brand'],
  cardsToEvaluate: Array<{ sectionTitle: string; width: number; height: number }>,
  sectionTitle: string
) {
  cardsToEvaluate.push({
    sectionTitle,
    width: cardWidth,
    height: cardHeight,
  });

  const cardId = `item-card-${item.id}`;
  elements.push({
    id: cardId,
    type: 'item_card',
    contentRef: item.id,
    x: cardX,
    y: cardY,
    width: cardWidth,
    height: cardHeight,
    locked: false,
    style: {
      density,
      border,
    },
  });

  const pad = Math.max(6, Math.floor(Math.min(cardWidth, cardHeight) * 0.05));
  const innerW = cardWidth - 2 * pad;
  const innerH = cardHeight - 2 * pad;

  const hasImage = !!item.imageAssetId;
  const isHorizontal = cardWidth > 1.5 * cardHeight;

  let imgX = 0, imgY = 0, imgW = 0, imgH = 0;
  let textX = 0, textY = 0, textW = 0, textH = 0;

  if (hasImage) {
    if (isHorizontal) {
      imgW = innerW * 0.4;
      imgH = innerH;
      imgX = cardX + pad;
      imgY = cardY + pad;

      textW = innerW * 0.55;
      textH = innerH;
      textX = cardX + pad + imgW + (innerW * 0.05);
      textY = cardY + pad;
    } else {
      imgW = innerW;
      imgH = innerH * 0.4;
      imgX = cardX + pad;
      imgY = cardY + pad;

      textW = innerW;
      textH = innerH * 0.55;
      textX = cardX + pad;
      textY = cardY + pad + imgH + (innerH * 0.05);
    }

    elements.push({
      id: `item-image-${item.id}`,
      type: 'image',
      contentRef: item.imageAssetId!,
      x: imgX,
      y: imgY,
      width: imgW,
      height: imgH,
      locked: false,
      style: {
        variant: item.layoutHints.imageFit,
      },
    });
  } else {
    textW = innerW;
    textH = innerH;
    textX = cardX + pad;
    textY = cardY + pad;
  }

  let currentTextY = textY;

  // Item Title (allocated 40% height)
  const titleH = textH * 0.4;
  const titleFit = fitText(item.title, textW, titleH, 16);
  textFitResults.push({ text: item.title, ...titleFit });

  elements.push({
    id: `item-title-${item.id}`,
    type: 'text',
    contentRef: `${item.id}.title`,
    x: textX,
    y: currentTextY,
    width: textW,
    height: titleH,
    locked: false,
    style: {
      fontSize: titleFit.fontSize,
      fontFamily: brand.fontPreferences.heading,
      color: brand.colors.secondary,
    },
  });
  currentTextY += titleH;

  // Item Subtitle & Description stacked
  let subtitleH = 0;
  if (item.subtitle) {
    subtitleH = textH * 0.15;
    const subFit = fitText(item.subtitle, textW, subtitleH, 12);
    textFitResults.push({ text: item.subtitle, ...subFit });

    elements.push({
      id: `item-subtitle-${item.id}`,
      type: 'text',
      contentRef: `${item.id}.subtitle`,
      x: textX,
      y: currentTextY,
      width: textW,
      height: subtitleH,
      locked: false,
      style: {
        fontSize: subFit.fontSize,
        fontFamily: brand.fontPreferences.body,
        color: brand.colors.muted,
      },
    });
    currentTextY += subtitleH;
  }

  if (item.description) {
    const descH = textH * 0.25;
    const descFit = fitText(item.description, textW, descH, 10);
    textFitResults.push({ text: item.description, ...descFit });

    elements.push({
      id: `item-description-${item.id}`,
      type: 'text',
      contentRef: `${item.id}.description`,
      x: textX,
      y: currentTextY,
      width: textW,
      height: descH,
      locked: false,
      style: {
        fontSize: descFit.fontSize,
        fontFamily: brand.fontPreferences.body,
        color: brand.colors.muted,
      },
    });
  }

  // Item Price (allocated 20% height, positioned at bottom right of card text box)
  if (item.price !== null || item.priceDisplay) {
    const priceH = textH * 0.2;
    const priceText = item.priceDisplay || `$${item.price}`;
    const priceFit = fitText(priceText, textW * 0.5, priceH, 16);
    textFitResults.push({ text: priceText, ...priceFit });

    elements.push({
      id: `item-price-${item.id}`,
      type: 'price',
      contentRef: `${item.id}.price`,
      x: textX + textW - textW * 0.5,
      y: textY + textH - priceH,
      width: textW * 0.5,
      height: priceH,
      locked: false,
      style: {
        fontSize: priceFit.fontSize,
        fontFamily: brand.fontPreferences.price,
        color: brand.colors.primary,
      },
    });
  }

  // Badge
  if (item.badge) {
    elements.push({
      id: `item-badge-${item.id}`,
      type: 'badge',
      contentRef: `${item.id}.badge`,
      x: cardX + pad,
      y: cardY + pad,
      width: Math.min(80, cardWidth * 0.3),
      height: Math.min(30, cardHeight * 0.2),
      locked: false,
      style: {
        color: brand.colors.secondary,
      },
    });
  }
}

/**
 * 1. Inventory Board Layout Solver (Original logic)
 */
function solveInventoryBoard(
  project: Project,
  elements: LayoutElement[],
  textFitResults: Array<{ text: string; fontSize: number; isTruncated: boolean }>,
  cardsToEvaluate: Array<{ sectionTitle: string; width: number; height: number }>
) {
  const { canvas, brand, content, layout } = project;

  let safeMargin = canvas.safeMarginPx;
  if (canvas.widthPx - 2 * safeMargin <= 0 || canvas.heightPx - 2 * safeMargin <= 0) {
    safeMargin = Math.min(canvas.widthPx, canvas.heightPx) * 0.05;
  }
  const safeX = safeMargin;
  const safeY = safeMargin;
  const safeWidth = canvas.widthPx - 2 * safeMargin;
  const safeHeight = canvas.heightPx - 2 * safeMargin;

  // Budget Header space
  const hasHeadline = !!content.headline;
  const hasSubheadline = !!content.subheadline;
  const headerHeight = (hasHeadline || hasSubheadline)
    ? Math.max(150, Math.floor(safeHeight * 0.08))
    : 0;

  if (headerHeight > 0) {
    if (hasHeadline) {
      const headlineH = hasSubheadline ? Math.floor(headerHeight * 0.6) : headerHeight;
      const fit = fitText(content.headline, safeWidth, headlineH, 48);
      textFitResults.push({ text: content.headline, ...fit });

      elements.push({
        id: 'header-headline',
        type: 'text',
        contentRef: 'content.headline',
        x: safeX,
        y: safeY,
        width: safeWidth,
        height: headlineH,
        locked: false,
        style: {
          fontSize: fit.fontSize,
          fontFamily: brand.fontPreferences.heading,
          color: brand.colors.primary,
        },
      });
    }

    if (hasSubheadline) {
      const headlineH = hasHeadline ? Math.floor(headerHeight * 0.6) : 0;
      const subheadlineH = hasHeadline ? Math.floor(headerHeight * 0.4) : headerHeight;
      const subheadlineY = safeY + headlineH;
      const fit = fitText(content.subheadline, safeWidth, subheadlineH, 24);
      textFitResults.push({ text: content.subheadline, ...fit });

      elements.push({
        id: 'header-subheadline',
        type: 'text',
        contentRef: 'content.subheadline',
        x: safeX,
        y: subheadlineY,
        width: safeWidth,
        height: subheadlineH,
        locked: false,
        style: {
          fontSize: fit.fontSize,
          fontFamily: brand.fontPreferences.body,
          color: brand.colors.muted,
        },
      });
    }
  }

  // Budget Footer space
  const hasFooter = !!brand.defaultFooter || !!brand.defaultDisclaimer;
  const footerHeight = hasFooter ? Math.max(100, Math.floor(safeHeight * 0.06)) : 0;

  if (footerHeight > 0) {
    const footerText = `${brand.defaultFooter} ${brand.defaultDisclaimer}`.trim();
    const fit = fitText(footerText, safeWidth, footerHeight, 14);
    textFitResults.push({ text: footerText, ...fit });

    elements.push({
      id: 'footer-container',
      type: 'footer',
      contentRef: 'brand.defaultFooter',
      x: safeX,
      y: safeY + safeHeight - footerHeight,
      width: safeWidth,
      height: footerHeight,
      locked: false,
      style: {
        fontSize: fit.fontSize,
        fontFamily: brand.fontPreferences.body,
        color: brand.colors.muted,
      },
    });
  }

  // Partition Main area vertically among visible sections
  const mainY = safeY + headerHeight;
  const mainHeight = Math.max(100, safeHeight - headerHeight - footerHeight);

  const visibleSections = content.sections.filter(
    (s) => s.items && s.items.some((item) => item.visibility !== 'hidden')
  );

  const numSections = visibleSections.length;
  if (numSections > 0) {
    let gap = 30;
    const cumulativeGap = (numSections - 1) * 30;
    if (cumulativeGap > mainHeight * 0.2) {
      gap = Math.min(30, (mainHeight * 0.2) / Math.max(1, numSections - 1));
    }
    const totalGap = (numSections - 1) * gap;
    const availableMainHeight = Math.max(0, mainHeight - Math.max(0, totalGap));

    const sectionWeights = visibleSections.map((s) =>
      s.priority === 'high' ? 1.5 : s.priority === 'low' ? 0.5 : 1.0
    );
    const totalWeight = sectionWeights.reduce((a, b) => a + b, 0) || 1;

    let currentY = mainY;

    visibleSections.forEach((section, sIdx) => {
      const weight = sectionWeights[sIdx];
      const sectionHeight = (weight / totalWeight) * availableMainHeight;

      // Section Header
      const sectionHeaderHeight = Math.min(80, Math.floor(sectionHeight * 0.15));
      if (sectionHeaderHeight > 0) {
        const fit = fitText(section.title, safeWidth, sectionHeaderHeight, 28);
        textFitResults.push({ text: section.title, ...fit });

        elements.push({
          id: `section-header-${section.id}`,
          type: 'section_header',
          contentRef: section.id,
          x: safeX,
          y: currentY,
          width: safeWidth,
          height: sectionHeaderHeight,
          locked: false,
          style: {
            fontSize: fit.fontSize,
            fontFamily: brand.fontPreferences.heading,
            color: brand.colors.primary,
          },
        });
      }

      // Section Grid area layout
      const gridY = currentY + sectionHeaderHeight;
      const gridHeight = Math.max(0, sectionHeight - sectionHeaderHeight);
      const visibleItems = section.items.filter((item) => item.visibility !== 'hidden');
      const N = visibleItems.length;

      if (N > 0 && gridHeight > 0) {
        let bestCols = 1;
        let bestRows = N;
        let bestConfigScore = -Infinity;

        const density = layout.density || 'normal';

        for (let c = 1; c <= Math.min(N, 6); c++) {
          const r = Math.ceil(N / c);
          const cardW = safeWidth / c;
          const cardH = gridHeight / r;
          const aspect = cardW / cardH;

          let configScore = 0;

          if (density === 'loose') {
            configScore += (6 - c) * 10;
          } else if (density === 'dense') {
            configScore += c * 10;
          }

          if (cardW < 120 || cardH < 60) {
            configScore -= 1000;
          } else if (cardW < 200 || cardH < 100) {
            configScore -= 100;
          }

          const aspectDiff = Math.abs(aspect - 1.33);
          configScore -= aspectDiff * 50;

          if (configScore > bestConfigScore) {
            bestConfigScore = configScore;
            bestCols = c;
            bestRows = r;
          }
        }

        const cols = bestCols;
        const rows = bestRows;
        const baseCardWidth = safeWidth / cols;
        const baseCardHeight = gridHeight / rows;

        visibleItems.forEach((item, itemIdx) => {
          const colIndex = itemIdx % cols;
          const rowIndex = Math.floor(itemIdx / cols);
          const cardX = safeX + colIndex * baseCardWidth;
          const cardY = gridY + rowIndex * baseCardHeight;
          const cardWidth = baseCardWidth;
          const cardHeight = baseCardHeight;

          renderItemCard(
            item,
            cardX,
            cardY,
            cardWidth,
            cardHeight,
            density,
            true,
            elements,
            textFitResults,
            brand,
            cardsToEvaluate,
            section.title
          );
        });
      }

      currentY += sectionHeight + gap;
    });
  }
}

/**
 * 2. Hero Grid Layout Solver
 */
function solveHeroGrid(
  project: Project,
  elements: LayoutElement[],
  textFitResults: Array<{ text: string; fontSize: number; isTruncated: boolean }>,
  cardsToEvaluate: Array<{ sectionTitle: string; width: number; height: number }>
) {
  const { canvas, brand, content, layout } = project;

  let safeMargin = canvas.safeMarginPx;
  if (canvas.widthPx - 2 * safeMargin <= 0 || canvas.heightPx - 2 * safeMargin <= 0) {
    safeMargin = Math.min(canvas.widthPx, canvas.heightPx) * 0.05;
  }
  const safeX = safeMargin;
  const safeY = safeMargin;
  const safeWidth = canvas.widthPx - 2 * safeMargin;
  const safeHeight = canvas.heightPx - 2 * safeMargin;

  // Budget Header space
  const hasHeadline = !!content.headline;
  const hasSubheadline = !!content.subheadline;
  const headerHeight = (hasHeadline || hasSubheadline)
    ? Math.max(150, Math.floor(safeHeight * 0.08))
    : 0;

  if (headerHeight > 0) {
    if (hasHeadline) {
      const headlineH = hasSubheadline ? Math.floor(headerHeight * 0.6) : headerHeight;
      const fit = fitText(content.headline, safeWidth, headlineH, 48);
      textFitResults.push({ text: content.headline, ...fit });

      elements.push({
        id: 'header-headline',
        type: 'text',
        contentRef: 'content.headline',
        x: safeX,
        y: safeY,
        width: safeWidth,
        height: headlineH,
        locked: false,
        style: {
          fontSize: fit.fontSize,
          fontFamily: brand.fontPreferences.heading,
          color: brand.colors.primary,
        },
      });
    }

    if (hasSubheadline) {
      const headlineH = hasHeadline ? Math.floor(headerHeight * 0.6) : 0;
      const subheadlineH = hasHeadline ? Math.floor(headerHeight * 0.4) : headerHeight;
      const fit = fitText(content.subheadline, safeWidth, subheadlineH, 24);
      textFitResults.push({ text: content.subheadline, ...fit });

      elements.push({
        id: 'header-subheadline',
        type: 'text',
        contentRef: 'content.subheadline',
        x: safeX,
        y: safeY + headlineH,
        width: safeWidth,
        height: subheadlineH,
        locked: false,
        style: {
          fontSize: fit.fontSize,
          fontFamily: brand.fontPreferences.body,
          color: brand.colors.muted,
        },
      });
    }
  }

  // Budget Footer space
  const hasFooter = !!brand.defaultFooter || !!brand.defaultDisclaimer;
  const footerHeight = hasFooter ? Math.max(100, Math.floor(safeHeight * 0.06)) : 0;

  if (footerHeight > 0) {
    const footerText = `${brand.defaultFooter} ${brand.defaultDisclaimer}`.trim();
    const fit = fitText(footerText, safeWidth, footerHeight, 14);
    textFitResults.push({ text: footerText, ...fit });

    elements.push({
      id: 'footer-container',
      type: 'footer',
      contentRef: 'brand.defaultFooter',
      x: safeX,
      y: safeY + safeHeight - footerHeight,
      width: safeWidth,
      height: footerHeight,
      locked: false,
      style: {
        fontSize: fit.fontSize,
        fontFamily: brand.fontPreferences.body,
        color: brand.colors.muted,
      },
    });
  }

  const mainY = safeY + headerHeight;
  const mainHeight = Math.max(100, safeHeight - headerHeight - footerHeight);

  // Collect all visible items
  const visibleSections = content.sections.filter(
    (s) => s.items && s.items.some((item) => item.visibility !== 'hidden')
  );
  const allVisibleItems = visibleSections.flatMap((s) => s.items.filter((item) => item.visibility !== 'hidden'));

  if (allVisibleItems.length > 0) {
    // Find hero item: priority === 'hero', or the first item
    let heroIndex = allVisibleItems.findIndex((item) => item.priority === 'hero');
    if (heroIndex === -1) {
      heroIndex = 0;
    }
    const heroItem = allVisibleItems[heroIndex];
    const nonHeroItems = allVisibleItems.filter((_, idx) => idx !== heroIndex);

    // Hero gets 45% height (40% - 50% range)
    const heroHeight = Math.floor(mainHeight * 0.45);
    const gap = 30;

    renderItemCard(
      heroItem,
      safeX,
      mainY,
      safeWidth,
      heroHeight,
      layout.density || 'normal',
      true,
      elements,
      textFitResults,
      brand,
      cardsToEvaluate,
      'Hero Item'
    );

    // Remaining height partition for other items
    const remainingY = mainY + heroHeight + gap;
    const remainingHeight = Math.max(100, mainHeight - heroHeight - gap);
    const N = nonHeroItems.length;

    if (N > 0) {
      let bestCols = 1;
      let bestRows = N;
      let bestConfigScore = -Infinity;

      const density = layout.density || 'normal';

      for (let c = 1; c <= Math.min(N, 6); c++) {
        const r = Math.ceil(N / c);
        const cardW = safeWidth / c;
        const cardH = remainingHeight / r;
        const aspect = cardW / cardH;

        let configScore = 0;

        if (density === 'loose') {
          configScore += (6 - c) * 10;
        } else if (density === 'dense') {
          configScore += c * 10;
        }

        if (cardW < 120 || cardH < 60) {
          configScore -= 1000;
        } else if (cardW < 200 || cardH < 100) {
          configScore -= 100;
        }

        const aspectDiff = Math.abs(aspect - 1.33);
        configScore -= aspectDiff * 50;

        if (configScore > bestConfigScore) {
          bestConfigScore = configScore;
          bestCols = c;
          bestRows = r;
        }
      }

      const cols = bestCols;
      const rows = bestRows;
      const cardWidth = safeWidth / cols;
      const cardHeight = remainingHeight / rows;

      nonHeroItems.forEach((item, itemIdx) => {
        const colIndex = itemIdx % cols;
        const rowIndex = Math.floor(itemIdx / cols);
        const cardX = safeX + colIndex * cardWidth;
        const cardY = remainingY + rowIndex * cardHeight;

        renderItemCard(
          item,
          cardX,
          cardY,
          cardWidth,
          cardHeight,
          density,
          true,
          elements,
          textFitResults,
          brand,
          cardsToEvaluate,
          'Grid Items'
        );
      });
    }
  }
}

/**
 * 3. Menu Listing Layout Solver
 */
function solveMenuListing(
  project: Project,
  elements: LayoutElement[],
  textFitResults: Array<{ text: string; fontSize: number; isTruncated: boolean }>,
  cardsToEvaluate: Array<{ sectionTitle: string; width: number; height: number }>
) {
  const { canvas, brand, content, layout } = project;

  let safeMargin = canvas.safeMarginPx;
  if (canvas.widthPx - 2 * safeMargin <= 0 || canvas.heightPx - 2 * safeMargin <= 0) {
    safeMargin = Math.min(canvas.widthPx, canvas.heightPx) * 0.05;
  }
  const safeX = safeMargin;
  const safeY = safeMargin;
  const safeWidth = canvas.widthPx - 2 * safeMargin;
  const safeHeight = canvas.heightPx - 2 * safeMargin;

  // Budget Header space
  const hasHeadline = !!content.headline;
  const hasSubheadline = !!content.subheadline;
  const headerHeight = (hasHeadline || hasSubheadline)
    ? Math.max(150, Math.floor(safeHeight * 0.08))
    : 0;

  if (headerHeight > 0) {
    if (hasHeadline) {
      const headlineH = hasSubheadline ? Math.floor(headerHeight * 0.6) : headerHeight;
      const fit = fitText(content.headline, safeWidth, headlineH, 48);
      textFitResults.push({ text: content.headline, ...fit });

      elements.push({
        id: 'header-headline',
        type: 'text',
        contentRef: 'content.headline',
        x: safeX,
        y: safeY,
        width: safeWidth,
        height: headlineH,
        locked: false,
        style: {
          fontSize: fit.fontSize,
          fontFamily: brand.fontPreferences.heading,
          color: brand.colors.primary,
        },
      });
    }

    if (hasSubheadline) {
      const headlineH = hasHeadline ? Math.floor(headerHeight * 0.6) : 0;
      const subheadlineH = hasHeadline ? Math.floor(headerHeight * 0.4) : headerHeight;
      const fit = fitText(content.subheadline, safeWidth, subheadlineH, 24);
      textFitResults.push({ text: content.subheadline, ...fit });

      elements.push({
        id: 'header-subheadline',
        type: 'text',
        contentRef: 'content.subheadline',
        x: safeX,
        y: safeY + headlineH,
        width: safeWidth,
        height: subheadlineH,
        locked: false,
        style: {
          fontSize: fit.fontSize,
          fontFamily: brand.fontPreferences.body,
          color: brand.colors.muted,
        },
      });
    }
  }

  // Budget Footer space
  const hasFooter = !!brand.defaultFooter || !!brand.defaultDisclaimer;
  const footerHeight = hasFooter ? Math.max(100, Math.floor(safeHeight * 0.06)) : 0;

  if (footerHeight > 0) {
    const footerText = `${brand.defaultFooter} ${brand.defaultDisclaimer}`.trim();
    const fit = fitText(footerText, safeWidth, footerHeight, 14);
    textFitResults.push({ text: footerText, ...fit });

    elements.push({
      id: 'footer-container',
      type: 'footer',
      contentRef: 'brand.defaultFooter',
      x: safeX,
      y: safeY + safeHeight - footerHeight,
      width: safeWidth,
      height: footerHeight,
      locked: false,
      style: {
        fontSize: fit.fontSize,
        fontFamily: brand.fontPreferences.body,
        color: brand.colors.muted,
      },
    });
  }

  const mainY = safeY + headerHeight;
  const mainHeight = Math.max(100, safeHeight - headerHeight - footerHeight);

  // Group by visible sections
  const visibleSections = content.sections.filter(
    (s) => s.items && s.items.some((item) => item.visibility !== 'hidden')
  );
  const numSections = visibleSections.length;

  if (numSections > 0) {
    const gap = 20;
    const totalGap = (numSections - 1) * gap;
    const availableMainHeight = Math.max(0, mainHeight - totalGap);

    const sectionWeights = visibleSections.map((s) =>
      s.priority === 'high' ? 1.5 : s.priority === 'low' ? 0.5 : 1.0
    );
    const totalWeight = sectionWeights.reduce((a, b) => a + b, 0) || 1;

    let currentY = mainY;

    visibleSections.forEach((section, sIdx) => {
      const weight = sectionWeights[sIdx];
      const sectionHeight = (weight / totalWeight) * availableMainHeight;

      // Section Header (aligned vertically above its section items)
      const sectionHeaderHeight = Math.min(80, Math.floor(sectionHeight * 0.15));
      if (sectionHeaderHeight > 0) {
        const fit = fitText(section.title, safeWidth, sectionHeaderHeight, 28);
        textFitResults.push({ text: section.title, ...fit });

        elements.push({
          id: `section-header-${section.id}`,
          type: 'section_header',
          contentRef: section.id,
          x: safeX,
          y: currentY,
          width: safeWidth,
          height: sectionHeaderHeight,
          locked: false,
          style: {
            fontSize: fit.fontSize,
            fontFamily: brand.fontPreferences.heading,
            color: brand.colors.primary,
          },
        });
      }

      const gridY = currentY + sectionHeaderHeight;
      const gridHeight = Math.max(0, sectionHeight - sectionHeaderHeight);
      const visibleItems = section.items.filter((item) => item.visibility !== 'hidden');
      const N = visibleItems.length;

      if (N > 0 && gridHeight > 0) {
        const baseRowHeight = gridHeight / N;
        const rowHeight = Math.min(80, baseRowHeight); // default smaller row height e.g. 80px

        visibleItems.forEach((item, itemIdx) => {
          const cardX = safeX;
          const cardY = gridY + itemIdx * rowHeight;
          const cardWidth = safeWidth;
          const cardHeight = rowHeight;

          cardsToEvaluate.push({
            sectionTitle: section.title,
            width: cardWidth,
            height: cardHeight,
          });

          // Item card with border: false
          elements.push({
            id: `item-card-${item.id}`,
            type: 'item_card',
            contentRef: item.id,
            x: cardX,
            y: cardY,
            width: cardWidth,
            height: cardHeight,
            locked: false,
            style: {
              border: false,
              density: layout.density || 'normal',
            },
          });

          const pad = Math.max(4, Math.floor(cardHeight * 0.05));
          const innerW = cardWidth - 2 * pad;
          const innerH = cardHeight - 2 * pad;

          const hasImage = !!item.imageAssetId;
          let imgW = 0;
          if (hasImage) {
            imgW = innerH; // square thumbnail
            elements.push({
              id: `item-image-${item.id}`,
              type: 'image',
              contentRef: item.imageAssetId!,
              x: cardX + pad,
              y: cardY + pad,
              width: imgW,
              height: innerH,
              locked: false,
              style: {
                variant: item.layoutHints.imageFit,
              },
            });
          }

          // Text area budget
          const textX = cardX + pad + (hasImage ? imgW + pad : 0);
          const textW = innerW - (hasImage ? imgW + pad : 0);

          // Align Title and Description on the left, Price on the right
          const rightW = textW * 0.25;
          const leftW = textW * 0.70;
          const priceX = textX + textW - rightW;

          let currentTextY = cardY + pad;
          const titleH = innerH * 0.5;
          const titleFit = fitText(item.title, leftW, titleH, 16);
          textFitResults.push({ text: item.title, ...titleFit });

          elements.push({
            id: `item-title-${item.id}`,
            type: 'text',
            contentRef: `${item.id}.title`,
            x: textX,
            y: currentTextY,
            width: leftW,
            height: titleH,
            locked: false,
            style: {
              fontSize: titleFit.fontSize,
              fontFamily: brand.fontPreferences.heading,
              color: brand.colors.secondary,
              textAlign: 'left',
            },
          });
          currentTextY += titleH;

          const secondaryText = item.description || item.subtitle;
          if (secondaryText) {
            const descH = innerH * 0.4;
            const descFit = fitText(secondaryText, leftW, descH, 12);
            textFitResults.push({ text: secondaryText, ...descFit });

            elements.push({
              id: `item-description-${item.id}`,
              type: 'text',
              contentRef: `${item.id}.description`,
              x: textX,
              y: currentTextY,
              width: leftW,
              height: descH,
              locked: false,
              style: {
                fontSize: descFit.fontSize,
                fontFamily: brand.fontPreferences.body,
                color: brand.colors.muted,
                textAlign: 'left',
              },
            });
          }

          if (item.price !== null || item.priceDisplay) {
            const priceText = item.priceDisplay || `$${item.price}`;
            const priceH = innerH * 0.6;
            const priceFit = fitText(priceText, rightW, priceH, 18);
            textFitResults.push({ text: priceText, ...priceFit });

            elements.push({
              id: `item-price-${item.id}`,
              type: 'price',
              contentRef: `${item.id}.price`,
              x: priceX,
              y: cardY + pad + (innerH - priceH) / 2,
              width: rightW,
              height: priceH,
              locked: false,
              style: {
                fontSize: priceFit.fontSize,
                fontFamily: brand.fontPreferences.price,
                color: brand.colors.primary,
                textAlign: 'right',
              },
            });
          }

          if (item.badge) {
            elements.push({
              id: `item-badge-${item.id}`,
              type: 'badge',
              contentRef: `${item.id}.badge`,
              x: textX + leftW - 60,
              y: cardY + pad,
              width: 60,
              height: 20,
              locked: false,
              style: {
                color: brand.colors.secondary,
              },
            });
          }
        });
      }

      currentY += sectionHeight + gap;
    });
  }
}

/**
 * 4. Comparison Chart Layout Solver
 */
function solveComparisonChart(
  project: Project,
  elements: LayoutElement[],
  textFitResults: Array<{ text: string; fontSize: number; isTruncated: boolean }>,
  cardsToEvaluate: Array<{ sectionTitle: string; width: number; height: number }>
) {
  const { canvas, brand, content, layout } = project;

  let safeMargin = canvas.safeMarginPx;
  if (canvas.widthPx - 2 * safeMargin <= 0 || canvas.heightPx - 2 * safeMargin <= 0) {
    safeMargin = Math.min(canvas.widthPx, canvas.heightPx) * 0.05;
  }
  const safeX = safeMargin;
  const safeY = safeMargin;
  const safeWidth = canvas.widthPx - 2 * safeMargin;
  const safeHeight = canvas.heightPx - 2 * safeMargin;

  // Budget Header space
  const hasHeadline = !!content.headline;
  const hasSubheadline = !!content.subheadline;
  const headerHeight = (hasHeadline || hasSubheadline)
    ? Math.max(150, Math.floor(safeHeight * 0.08))
    : 0;

  if (headerHeight > 0) {
    if (hasHeadline) {
      const headlineH = hasSubheadline ? Math.floor(headerHeight * 0.6) : headerHeight;
      const fit = fitText(content.headline, safeWidth, headlineH, 48);
      textFitResults.push({ text: content.headline, ...fit });

      elements.push({
        id: 'header-headline',
        type: 'text',
        contentRef: 'content.headline',
        x: safeX,
        y: safeY,
        width: safeWidth,
        height: headlineH,
        locked: false,
        style: {
          fontSize: fit.fontSize,
          fontFamily: brand.fontPreferences.heading,
          color: brand.colors.primary,
        },
      });
    }

    if (hasSubheadline) {
      const headlineH = hasHeadline ? Math.floor(headerHeight * 0.6) : 0;
      const subheadlineH = hasHeadline ? Math.floor(headerHeight * 0.4) : headerHeight;
      const fit = fitText(content.subheadline, safeWidth, subheadlineH, 24);
      textFitResults.push({ text: content.subheadline, ...fit });

      elements.push({
        id: 'header-subheadline',
        type: 'text',
        contentRef: 'content.subheadline',
        x: safeX,
        y: safeY + headlineH,
        width: safeWidth,
        height: subheadlineH,
        locked: false,
        style: {
          fontSize: fit.fontSize,
          fontFamily: brand.fontPreferences.body,
          color: brand.colors.muted,
        },
      });
    }
  }

  // Budget Footer space
  const hasFooter = !!brand.defaultFooter || !!brand.defaultDisclaimer;
  const footerHeight = hasFooter ? Math.max(100, Math.floor(safeHeight * 0.06)) : 0;

  if (footerHeight > 0) {
    const footerText = `${brand.defaultFooter} ${brand.defaultDisclaimer}`.trim();
    const fit = fitText(footerText, safeWidth, footerHeight, 14);
    textFitResults.push({ text: footerText, ...fit });

    elements.push({
      id: 'footer-container',
      type: 'footer',
      contentRef: 'brand.defaultFooter',
      x: safeX,
      y: safeY + safeHeight - footerHeight,
      width: safeWidth,
      height: footerHeight,
      locked: false,
      style: {
        fontSize: fit.fontSize,
        fontFamily: brand.fontPreferences.body,
        color: brand.colors.muted,
      },
    });
  }

  const mainY = safeY + headerHeight;
  const mainHeight = Math.max(100, safeHeight - headerHeight - footerHeight);

  const visibleSections = content.sections.filter(
    (s) => s.items && s.items.some((item) => item.visibility !== 'hidden')
  );
  const allVisibleItems = visibleSections.flatMap((s) => s.items.filter((item) => item.visibility !== 'hidden'));
  const N = allVisibleItems.length;

  if (N > 0) {
    const colGap = 15;
    const colWidth = (safeWidth - (N - 1) * colGap) / N;

    // Feature blocks aligned vertically
    const imageBlockHeight = Math.floor(mainHeight * 0.35);
    const titleBlockHeight = Math.floor(mainHeight * 0.15);
    const descBlockHeight = Math.floor(mainHeight * 0.35);
    const priceBlockHeight = Math.floor(mainHeight * 0.10);

    allVisibleItems.forEach((item, i) => {
      const colX = safeX + i * (colWidth + colGap);

      cardsToEvaluate.push({
        sectionTitle: 'Comparison Column',
        width: colWidth,
        height: mainHeight,
      });

      // Product Card column
      elements.push({
        id: `item-card-${item.id}`,
        type: 'item_card',
        contentRef: item.id,
        x: colX,
        y: mainY,
        width: colWidth,
        height: mainHeight,
        locked: false,
        style: {
          border: true,
          density: layout.density || 'normal',
        },
      });

      const pad = Math.max(6, Math.floor(colWidth * 0.05));
      const innerW = colWidth - 2 * pad;

      // Image
      const imgY = mainY + pad;
      const imgH = imageBlockHeight - pad;
      if (item.imageAssetId) {
        elements.push({
          id: `item-image-${item.id}`,
          type: 'image',
          contentRef: item.imageAssetId,
          x: colX + pad,
          y: imgY,
          width: innerW,
          height: imgH,
          locked: false,
          style: {
            variant: item.layoutHints.imageFit,
          },
        });
      }

      // Title
      const titleY = mainY + imageBlockHeight + pad;
      const titleH = titleBlockHeight - pad;
      const titleFit = fitText(item.title, innerW, titleH, 16);
      textFitResults.push({ text: item.title, ...titleFit });

      elements.push({
        id: `item-title-${item.id}`,
        type: 'text',
        contentRef: `${item.id}.title`,
        x: colX + pad,
        y: titleY,
        width: innerW,
        height: titleH,
        locked: false,
        style: {
          fontSize: titleFit.fontSize,
          fontFamily: brand.fontPreferences.heading,
          color: brand.colors.secondary,
          textAlign: 'center',
        },
      });

      // Description/Features
      const descY = mainY + imageBlockHeight + titleBlockHeight + pad;
      const descH = descBlockHeight - pad;
      const secondaryText = item.description || item.subtitle;
      if (secondaryText) {
        const descFit = fitText(secondaryText, innerW, descH, 11);
        textFitResults.push({ text: secondaryText, ...descFit });

        elements.push({
          id: `item-description-${item.id}`,
          type: 'text',
          contentRef: `${item.id}.description`,
          x: colX + pad,
          y: descY,
          width: innerW,
          height: descH,
          locked: false,
          style: {
            fontSize: descFit.fontSize,
            fontFamily: brand.fontPreferences.body,
            color: brand.colors.muted,
            textAlign: 'center',
          },
        });
      }

      // Price
      const priceY = mainY + imageBlockHeight + titleBlockHeight + descBlockHeight + pad;
      const priceH = priceBlockHeight - pad;
      if (item.price !== null || item.priceDisplay) {
        const priceText = item.priceDisplay || `$${item.price}`;
        const priceFit = fitText(priceText, innerW, priceH, 16);
        textFitResults.push({ text: priceText, ...priceFit });

        elements.push({
          id: `item-price-${item.id}`,
          type: 'price',
          contentRef: `${item.id}.price`,
          x: colX + pad,
          y: priceY,
          width: innerW,
          height: priceH,
          locked: false,
          style: {
            fontSize: priceFit.fontSize,
            fontFamily: brand.fontPreferences.price,
            color: brand.colors.primary,
            textAlign: 'center',
          },
        });
      }

      if (item.badge) {
        elements.push({
          id: `item-badge-${item.id}`,
          type: 'badge',
          contentRef: `${item.id}.badge`,
          x: colX + pad,
          y: imgY,
          width: Math.min(80, colWidth * 0.4),
          height: 25,
          locked: false,
          style: {
            color: brand.colors.secondary,
          },
        });
      }
    });
  }
}

/**
 * 5. Social Carousel Layout Solver
 */
function solveSocialCarousel(
  project: Project,
  elements: LayoutElement[],
  textFitResults: Array<{ text: string; fontSize: number; isTruncated: boolean }>,
  cardsToEvaluate: Array<{ sectionTitle: string; width: number; height: number }>
) {
  const { canvas, brand, content, layout } = project;

  let safeMargin = canvas.safeMarginPx;
  if (canvas.widthPx - 2 * safeMargin <= 0 || canvas.heightPx - 2 * safeMargin <= 0) {
    safeMargin = Math.min(canvas.widthPx, canvas.heightPx) * 0.05;
  }
  const safeX = safeMargin;
  const safeY = safeMargin;
  const safeWidth = canvas.widthPx - 2 * safeMargin;
  const safeHeight = canvas.heightPx - 2 * safeMargin;

  const visibleSections = content.sections.filter(
    (s) => s.items && s.items.some((item) => item.visibility !== 'hidden')
  );

  const contentSlides: Array<{ section: Section; chunk: Item[] }> = [];
  visibleSections.forEach((section) => {
    const visibleItems = section.items.filter((item) => item.visibility !== 'hidden');
    for (let i = 0; i < visibleItems.length; i += 4) {
      contentSlides.push({
        section,
        chunk: visibleItems.slice(i, i + 4),
      });
    }
  });

  const numSlides = 1 + contentSlides.length + 1;

  for (let k = 0; k < numSlides; k++) {
    const offset = k * canvas.widthPx;

    if (k === 0) {
      // Slide 0: Headline slide. Centers logo, headline, subheadline.
      const logoWidth = 200;
      const logoHeight = 120;
      const logoX = offset + safeX + (safeWidth - logoWidth) / 2;
      const logoY = safeY + safeHeight * 0.15;

      if (brand.logoAssetId) {
        elements.push({
          id: 'carousel-logo',
          type: 'image',
          contentRef: brand.logoAssetId,
          x: logoX,
          y: logoY,
          width: logoWidth,
          height: logoHeight,
          locked: false,
          style: { variant: 'contain' },
        });
      }

      const headlineY = logoY + logoHeight + 40;
      const headlineH = safeHeight * 0.25;
      const headlineFit = fitText(content.headline || brand.brandName, safeWidth, headlineH, 64);
      textFitResults.push({ text: content.headline || brand.brandName, ...headlineFit });

      elements.push({
        id: 'carousel-headline',
        type: 'text',
        contentRef: 'content.headline',
        x: offset + safeX,
        y: headlineY,
        width: safeWidth,
        height: headlineH,
        locked: false,
        style: {
          fontSize: headlineFit.fontSize,
          fontFamily: brand.fontPreferences.heading,
          color: brand.colors.primary,
          textAlign: 'center',
        },
      });

      const subheadlineY = headlineY + headlineH + 20;
      const subheadlineH = safeHeight * 0.15;
      const subheadlineFit = fitText(content.subheadline, safeWidth, subheadlineH, 32);
      textFitResults.push({ text: content.subheadline, ...subheadlineFit });

      elements.push({
        id: 'carousel-subheadline',
        type: 'text',
        contentRef: 'content.subheadline',
        x: offset + safeX,
        y: subheadlineY,
        width: safeWidth,
        height: subheadlineH,
        locked: false,
        style: {
          fontSize: subheadlineFit.fontSize,
          fontFamily: brand.fontPreferences.body,
          color: brand.colors.muted,
          textAlign: 'center',
        },
      });
    } else if (k >= 1 && k <= numSlides - 2) {
      // Content slides
      const { section, chunk } = contentSlides[k - 1];
      const M = chunk.length;

      const headerH = Math.min(80, Math.floor(safeHeight * 0.1));
      const fit = fitText(section.title, safeWidth, headerH, 28);
      textFitResults.push({ text: section.title, ...fit });

      elements.push({
        id: `carousel-section-header-${section.id}-${k}`,
        type: 'section_header',
        contentRef: section.id,
        x: offset + safeX,
        y: safeY,
        width: safeWidth,
        height: headerH,
        locked: false,
        style: {
          fontSize: fit.fontSize,
          fontFamily: brand.fontPreferences.heading,
          color: brand.colors.primary,
        },
      });

      const gridY = safeY + headerH + 20;
      const gridHeight = safeHeight - headerH - 20;

      const cols = M > 1 ? 2 : 1;
      const rows = M > 2 ? 2 : 1;
      const cardW = (safeWidth - (cols - 1) * 20) / cols;
      const cardH = (gridHeight - (rows - 1) * 20) / rows;

      chunk.forEach((item, idx) => {
        const colIdx = idx % cols;
        const rowIdx = Math.floor(idx / cols);
        const itemX = offset + safeX + colIdx * (cardW + 20);
        const itemY = gridY + rowIdx * (cardH + 20);

        renderItemCard(
          item,
          itemX,
          itemY,
          cardW,
          cardH,
          layout.density || 'normal',
          true,
          elements,
          textFitResults,
          brand,
          cardsToEvaluate,
          section.title
        );
      });
    } else if (k === numSlides - 1) {
      // Slide N-1: Closing slide.
      const brandH = safeHeight * 0.15;
      const contactH = safeHeight * 0.25;
      const qrH = safeHeight * 0.3;
      const footerH = safeHeight * 0.2;

      const brandY = safeY + 20;
      const brandFit = fitText(brand.brandName, safeWidth, brandH, 48);
      textFitResults.push({ text: brand.brandName, ...brandFit });

      elements.push({
        id: 'carousel-closing-brand',
        type: 'text',
        contentRef: 'brand.brandName',
        x: offset + safeX,
        y: brandY,
        width: safeWidth,
        height: brandH,
        locked: false,
        style: {
          fontSize: brandFit.fontSize,
          fontFamily: brand.fontPreferences.heading,
          color: brand.colors.primary,
          textAlign: 'center',
        },
      });

      const contactY = brandY + brandH + 20;
      const contactText = [brand.phone, brand.email, brand.website].filter(Boolean).join('\n');
      const contactFit = fitText(contactText, safeWidth, contactH, 20);
      textFitResults.push({ text: contactText, ...contactFit });

      elements.push({
        id: 'carousel-closing-contact',
        type: 'text',
        contentRef: 'brand.email',
        x: offset + safeX,
        y: contactY,
        width: safeWidth,
        height: contactH,
        locked: false,
        style: {
          fontSize: contactFit.fontSize,
          fontFamily: brand.fontPreferences.body,
          color: brand.colors.secondary,
          textAlign: 'center',
        },
      });

      const qrSize = Math.min(180, qrH);
      const qrX = offset + safeX + (safeWidth - qrSize) / 2;
      const qrY = contactY + contactH + 20;

      if (brand.website) {
        elements.push({
          id: 'carousel-closing-qrcode',
          type: 'qr_code',
          contentRef: 'brand.website',
          x: qrX,
          y: qrY,
          width: qrSize,
          height: qrSize,
          locked: false,
          style: {
            color: brand.colors.primary,
          },
        });
      }

      const footerTextY = safeY + safeHeight - footerH;
      const footerText = [brand.defaultFooter, brand.defaultDisclaimer].filter(Boolean).join('\n');
      const footerFit = fitText(footerText, safeWidth, footerH, 14);
      textFitResults.push({ text: footerText, ...footerFit });

      elements.push({
        id: 'carousel-closing-footer',
        type: 'footer',
        contentRef: 'brand.defaultFooter',
        x: offset + safeX,
        y: footerTextY,
        width: safeWidth,
        height: footerH,
        locked: false,
        style: {
          fontSize: footerFit.fontSize,
          fontFamily: brand.fontPreferences.body,
          color: brand.colors.muted,
          textAlign: 'center',
        },
      });
    }
  }
}
