import { LayoutElement } from '../schemas/project';

export interface LayoutEvaluationResult {
  score: number;
  warnings: string[];
}

/**
 * Evaluates layout constraints and calculates quality scores and warnings.
 */
export function evaluateLayout(
  elements: LayoutElement[],
  cards: Array<{ sectionTitle: string; width: number; height: number }>,
  textFitResults: Array<{ text: string; fontSize: number; isTruncated: boolean }>,
  canvasWidth: number,
  canvasHeight: number,
  slideWidth?: number
): LayoutEvaluationResult {
  const warnings: string[] = [];
  let score = 100;

  // 1. Check for overcrowding (card < 120x60px)
  let overcrowdingDeductions = 0;
  const processedOvercrowdingSections = new Set<string>();

  for (const card of cards) {
    if (card.width < 120 || card.height < 60) {
      if (!processedOvercrowdingSections.has(card.sectionTitle)) {
        warnings.push(`Overcrowded cards in section "${card.sectionTitle}": card size ${Math.round(card.width)}x${Math.round(card.height)}px is below the 120x60px limit.`);
        processedOvercrowdingSections.add(card.sectionTitle);
      }
      overcrowdingDeductions += 10;
    }
  }
  score -= Math.min(30, overcrowdingDeductions);

  // 2. Check for tiny text and truncation
  let tinyTextDeductions = 0;
  let truncationDeductions = 0;

  for (const result of textFitResults) {
    if (result.fontSize < 10 || (result.fontSize === 10 && result.isTruncated)) {
      warnings.push(`Text scaled down to tiny size (${result.fontSize}px): "${result.text.substring(0, 20)}..."`);
      tinyTextDeductions += 5;
    }
    if (result.isTruncated) {
      warnings.push(`Text truncated due to overflow: "${result.text.substring(0, 20)}..."`);
      truncationDeductions += 3;
    }
  }

  score -= Math.min(20, tinyTextDeductions);
  score -= Math.min(20, truncationDeductions);

  // 3. Out-of-Bounds Canvas Checks
  let outOfBoundsDeductions = 0;
  const effectiveSlideWidth = slideWidth || canvasWidth;
  for (const el of elements) {
    if (el.x < 0 || el.y < 0 || el.x + el.width > canvasWidth || el.y + el.height > canvasHeight) {
      warnings.push(
        `Element "${el.id}" (${el.type}) is out of canvas bounds: x=${Math.round(el.x)}, y=${Math.round(
          el.y
        )}, w=${Math.round(el.width)}, h=${Math.round(el.height)} px on canvas ${canvasWidth}x${canvasHeight}.`
      );
      outOfBoundsDeductions += 10;
    } else if (el.width > 0 && effectiveSlideWidth < canvasWidth) {
      const startSlide = Math.floor(el.x / effectiveSlideWidth);
      const endSlide = Math.floor((el.x + el.width - 0.01) / effectiveSlideWidth);
      if (startSlide !== endSlide) {
        warnings.push(
          `Element "${el.id}" (${el.type}) crosses slide boundaries: starts on slide ${startSlide + 1} and ends on slide ${endSlide + 1}.`
        );
        outOfBoundsDeductions += 15;
      }
    }
  }
  score -= Math.min(30, outOfBoundsDeductions);


  // 4. Overlapping Top-level Elements Checks (Layout Collisions)
  let overlapDeductions = 0;
  const topLevelTypes = ['item_card', 'section_header', 'footer', 'qr_code', 'ai_instruction_zone'];
  const topLevelElements = elements.filter(
    (el) =>
      topLevelTypes.includes(el.type) ||
      (el.type === 'text' && (el.id === 'header-headline' || el.id === 'header-subheadline'))
  );

  const reportedPairs = new Set<string>();

  for (let i = 0; i < topLevelElements.length; i++) {
    for (let j = i + 1; j < topLevelElements.length; j++) {
      const elA = topLevelElements[i];
      const elB = topLevelElements[j];

      if (
        elA.x < elB.x + elB.width &&
        elA.x + elA.width > elB.x &&
        elA.y < elB.y + elB.height &&
        elA.y + elA.height > elB.y
      ) {
        const pairKey = [elA.id, elB.id].sort().join('::');
        if (!reportedPairs.has(pairKey)) {
          reportedPairs.add(pairKey);
          warnings.push(
            `Layout collision: Element "${elA.id}" (${elA.type}) overlaps with "${elB.id}" (${elB.type}).`
          );
          overlapDeductions += 15;
        }
      }
    }
  }
  score -= Math.min(30, overlapDeductions);

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  return { score, warnings };
}
