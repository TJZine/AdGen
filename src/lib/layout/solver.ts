import { Project, LayoutElement } from '../schemas/project';
import { fitText } from './textFit';
import { evaluateLayout } from '../validation/rules';

/**
 * Solve layout calculations for the AdGen flyer using Hierarchical Grid Partitioning (HGP).
 */
export function solveLayout(project: Project): { elements: LayoutElement[]; score: number; warnings: string[] } {
  const { canvas, brand, content, layout } = project;
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

  let safeMargin = canvas.safeMarginPx;
  if (canvas.widthPx - 2 * safeMargin <= 0 || canvas.heightPx - 2 * safeMargin <= 0) {
    safeMargin = Math.min(canvas.widthPx, canvas.heightPx) * 0.05;
  }
  const safeX = safeMargin;
  const safeY = safeMargin;
  const safeWidth = canvas.widthPx - 2 * safeMargin;
  const safeHeight = canvas.heightPx - 2 * safeMargin;

  const textFitResults: Array<{ text: string; fontSize: number; isTruncated: boolean }> = [];
  const cardsToEvaluate: Array<{ sectionTitle: string; width: number; height: number }> = [];

  // 1. Budget Header space
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

  // 2. Budget Footer space
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

  // 3. Partition Main area vertically among visible sections
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

    // Priority Weights: High = 1.5, Normal = 1.0, Low = 0.5
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
        // Optimize grid rows & columns selection
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

          // Density preference
          if (density === 'loose') {
            configScore += (6 - c) * 10;
          } else if (density === 'dense') {
            configScore += c * 10;
          }

          // Card dimensions constraint checks
          if (cardW < 120 || cardH < 60) {
            configScore -= 1000;
          } else if (cardW < 200 || cardH < 100) {
            configScore -= 100;
          }

          // Aspect ratio preference (target: 4:3 aspect ratio, ~1.33)
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
          let initialCardX = safeX + colIndex * baseCardWidth;
          let initialCardY = gridY + rowIndex * baseCardHeight;
          let activeCardWidth = baseCardWidth;
          let activeCardHeight = baseCardHeight;

          const cardId = `item-card-${item.id}`;
          const existingCard = project.layout?.elements?.find((x) => x.id === cardId);
          if (existingCard && existingCard.locked) {
            initialCardX = existingCard.x;
            initialCardY = existingCard.y;
            activeCardWidth = existingCard.width;
            activeCardHeight = existingCard.height;
          }

          const cardX = initialCardX;
          const cardY = initialCardY;
          const cardWidth = activeCardWidth;
          const cardHeight = activeCardHeight;

          cardsToEvaluate.push({
            sectionTitle: section.title,
            width: cardWidth,
            height: cardHeight,
          });

          // Add card background element
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
              border: true,
            },
          });

          // Padding inside the card
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

          // Vertically budget card sub-text elements
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

          // Badge (place badge at top corner overlaying card)
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
        });
      }

      currentY += sectionHeight + gap;
    });
  }

  // 4. Score and evaluate constraints
  const { score, warnings } = evaluateLayout(
    elements,
    cardsToEvaluate,
    textFitResults,
    canvas.widthPx,
    canvas.heightPx
  );

  return {
    elements,
    score,
    warnings,
  };
}
