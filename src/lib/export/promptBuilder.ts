import { Project } from '../schemas/project';

interface AspectRatio {
  ratioText: string;
  value: number;
}

const MJ_ASPECT_RATIOS: AspectRatio[] = [
  { ratioText: '1:1', value: 1.0 },
  { ratioText: '16:9', value: 16 / 9 },
  { ratioText: '9:16', value: 9 / 16 },
  { ratioText: '4:3', value: 4 / 3 },
  { ratioText: '3:4', value: 3 / 4 },
  { ratioText: '2:3', value: 2 / 3 },
  { ratioText: '3:2', value: 3 / 2 },
  { ratioText: '11:17', value: 11 / 17 },
  { ratioText: '17:11', value: 17 / 11 },
];

/**
 * Resolves the closest Midjourney aspect ratio based on physical canvas width and height.
 */
export function getClosestAspectRatio(width: number, height: number): string {
  if (!width || !height) return '1:1';
  const targetRatio = width / height;
  let bestMatch = MJ_ASPECT_RATIOS[0];
  let minDiff = Math.abs(targetRatio - bestMatch.value);

  for (const ar of MJ_ASPECT_RATIOS) {
    const diff = Math.abs(targetRatio - ar.value);
    if (diff < minDiff) {
      minDiff = diff;
      bestMatch = ar;
    }
  }

  return bestMatch.ratioText;
}

/**
 * Compiles a visual description and prompt for the AI image generator.
 */
export function compilePrompt(project: Project): string {
  const ar = getClosestAspectRatio(project.canvas.widthPx, project.canvas.heightPx);
  const keywords = project.brand.styleKeywords.join(', ');
  
  // Count items and sections
  const sections = project.content.sections || [];
  const totalItems = sections.reduce((acc, s) => acc + (s.items?.length || 0), 0);
  
  const sectionSummary = sections
    .map(
      (s) =>
        `- **${s.title}**: Grid layout, contains ${s.items?.length || 0} product card slots.`
    )
    .join('\n');

  return `# AI Visual Polish Prompt Instructions

## Target Style & Mood
- **Brand Profile Name:** ${project.brand.brandName}
- **Style Direction Modifiers:** ${keywords}
- **Aesthetic Direction:** Premium, high contrast, clean graphic framing, modern commercial layout.

## Composition Layout (Structure Reference)
This visual prompt corresponds to a structural grid layout of ${sections.length} sections and ${totalItems} product item cards:
${sectionSummary}

## Downstream AI Prompt (Copy/Paste this to your AI Image Generator)
> A professional commercial poster layout background for a product inventory board.
> Style keywords: ${keywords}.
> Flat layout design, clean structured grid cards, clean border frames, high-end studio lighting.
> Empty product card slots for displaying merchandise.
> IMPORTANT: DO NOT WRITE ANY TEXT. NO LETTERS. NO WORDS. NO PRICING NUMBERS.
> Only visual background templates, solid containers, and premium textured design. --ar ${ar} --v 6.0

---
*Note: This package contains a visual layout reference file \`renders/rough-layout.png\` and a text-free template \`renders/rough-layout-background-only.png\`. You can use them as control images or image-to-image references.*
`;
}

/**
 * Returns a negative prompt string to suppress text rendering in AI models.
 */
export function getNegativePrompt(): string {
  return [
    'text',
    'letters',
    'words',
    'spelling',
    'typo',
    'grammar',
    'typography',
    'font',
    'title',
    'name',
    'signature',
    'watermark',
    'label',
    'pricing',
    'numbers',
    'currency',
    'logo',
    'handwriting',
    'captions',
  ].join(', ');
}
