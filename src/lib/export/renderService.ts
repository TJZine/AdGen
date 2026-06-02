import { chromium } from '@playwright/test';
import { prisma } from '../db';
import { ProjectSchema } from '../schemas/project';
import { solveLayout } from '../layout/solver';
import { fitText } from '../layout/textFit';
import { getElementText } from '../../components/renderer/BackgroundRenderer';

/**
 * Renders the flyer layout as a PNG binary Buffer using headless Chromium via Playwright.
 *
 * @param projectId - The project UUID
 * @param mode - 'full' (with overlay text) or 'background_only' (without overlay text)
 * @returns Promise<Buffer> - The PNG image as a binary buffer
 */
export async function renderLayoutPng(
  projectId: string,
  mode: 'full' | 'background_only'
): Promise<Buffer> {
  // 1. Fetch project dimensions from database
  const projectRecord = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!projectRecord) {
    throw new Error(`Project with ID ${projectId} not found`);
  }

  let rawProject: unknown;
  try {
    rawProject = JSON.parse(projectRecord.contentJson);
  } catch {
    throw new Error(`Failed to parse contentJson for project ${projectId}`);
  }

  const projectResult = ProjectSchema.safeParse(rawProject);
  if (!projectResult.success) {
    throw new Error(`Project validation failed: ${projectResult.error.message}`);
  }

  const { widthPx, heightPx } = projectResult.data.canvas;

  // 2. Launch headless Chromium browser
  const browser = await chromium.launch({
    headless: true,
  });

  try {
    // 3. Create context with exact viewport size
    const context = await browser.newContext({
      viewport: {
        width: widthPx,
        height: heightPx,
      },
      deviceScaleFactor: 1,
    });

    const page = await context.newPage();

    // 4. Construct URL with parameters (fall back to localhost:3000 if env not set)
    const baseUrl =
      process.env.RENDER_BASE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3000';
    const url = `${baseUrl}/render-canvas?id=${projectId}&mode=${mode}`;

    // 5. Navigate to rendering route and wait until network is idle
    await page.goto(url, {
      waitUntil: 'networkidle',
    });

    // Wait for web fonts to load
    await page.evaluate(() => document.fonts.ready);

    // 6. Ensure the main canvas is visible
    await page.waitForSelector('[data-testid="canvas-preview-container"]', {
      state: 'visible',
      timeout: 10000,
    });

    // 7. Take PNG screenshot of the canvas element specifically
    const pngBuffer = await page.locator('[data-testid="canvas-preview-container"]').screenshot({
      type: 'png',
    });

    return pngBuffer;
  } finally {
    // 8. Always close browser
    await browser.close();
  }
}

/**
 * Optimized method to render both full and background-only flyer layouts in a single browser session.
 */
export async function renderLayoutImages(
  projectId: string
): Promise<{ full: Buffer; backgroundOnly: Buffer }> {
  const projectRecord = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!projectRecord) {
    throw new Error(`Project with ID ${projectId} not found`);
  }

  let rawProject: unknown;
  try {
    rawProject = JSON.parse(projectRecord.contentJson);
  } catch {
    throw new Error(`Failed to parse contentJson for project ${projectId}`);
  }

  const projectResult = ProjectSchema.safeParse(rawProject);
  if (!projectResult.success) {
    throw new Error(`Project validation failed: ${projectResult.error.message}`);
  }

  const { widthPx, heightPx } = projectResult.data.canvas;

  const browser = await chromium.launch({
    headless: true,
  });

  try {
    const context = await browser.newContext({
      viewport: {
        width: widthPx,
        height: heightPx,
      },
      deviceScaleFactor: 1,
    });

    const page = await context.newPage();
    const baseUrl =
      process.env.RENDER_BASE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3000';

    // 1. Render and capture full layout
    const urlFull = `${baseUrl}/render-canvas?id=${projectId}&mode=full`;
    await page.goto(urlFull, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForSelector('[data-testid="canvas-preview-container"]', {
      state: 'visible',
      timeout: 10000,
    });
    const fullBuffer = await page.locator('[data-testid="canvas-preview-container"]').screenshot({
      type: 'png',
    });

    // 2. Render and capture background-only layout
    const urlBg = `${baseUrl}/render-canvas?id=${projectId}&mode=background_only`;
    await page.goto(urlBg, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForSelector('[data-testid="canvas-preview-container"]', {
      state: 'visible',
      timeout: 10000,
    });
    const bgBuffer = await page.locator('[data-testid="canvas-preview-container"]').screenshot({
      type: 'png',
    });

    return {
      full: fullBuffer,
      backgroundOnly: bgBuffer,
    };
  } finally {
    await browser.close();
  }
}

/**
 * Renders only the text overlay layer as a transparent PNG binary Buffer.
 *
 * @param projectId - The project UUID
 * @returns Promise<Buffer> - The transparent PNG image as a binary buffer
 */
export async function renderLayoutOverlayPng(projectId: string): Promise<Buffer> {
  // 1. Fetch project dimensions from database
  const projectRecord = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!projectRecord) {
    throw new Error(`Project with ID ${projectId} not found`);
  }

  let rawProject: unknown;
  try {
    rawProject = JSON.parse(projectRecord.contentJson);
  } catch {
    throw new Error(`Failed to parse contentJson for project ${projectId}`);
  }

  const projectResult = ProjectSchema.safeParse(rawProject);
  if (!projectResult.success) {
    throw new Error(`Project validation failed: ${projectResult.error.message}`);
  }

  const { widthPx, heightPx } = projectResult.data.canvas;

  // 2. Launch headless Chromium browser
  const browser = await chromium.launch({
    headless: true,
  });

  try {
    // 3. Create context with exact viewport size
    const context = await browser.newContext({
      viewport: {
        width: widthPx,
        height: heightPx,
      },
      deviceScaleFactor: 1,
    });

    const page = await context.newPage();

    // 4. Construct URL with parameters (fall back to localhost:3000 if env not set)
    const baseUrl =
      process.env.RENDER_BASE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3000';
    const url = `${baseUrl}/render-canvas?id=${projectId}&mode=overlay`;

    // 5. Navigate to rendering route and wait until network is idle
    await page.goto(url, {
      waitUntil: 'networkidle',
    });

    // Wait for web fonts to load
    await page.evaluate(() => document.fonts.ready);

    // 6. Ensure the main canvas is visible
    await page.waitForSelector('[data-testid="canvas-preview-container"]', {
      state: 'visible',
      timeout: 10000,
    });

    // 7. Take PNG screenshot of the canvas element specifically, omitting background for transparency
    const pngBuffer = await page.locator('[data-testid="canvas-preview-container"]').screenshot({
      type: 'png',
      omitBackground: true,
    });

    return pngBuffer;
  } finally {
    // 8. Always close browser
    await browser.close();
  }
}

/**
 * Generates text overlay elements purely as a clean vector SVG string on the server side.
 *
 * @param projectId - The project UUID
 * @returns Promise<string> - The SVG XML content
 */
export async function renderLayoutOverlaySvg(projectId: string): Promise<string> {
  // 1. Fetch project from database
  const projectRecord = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!projectRecord) {
    throw new Error(`Project with ID ${projectId} not found`);
  }

  let rawProject: unknown;
  try {
    rawProject = JSON.parse(projectRecord.contentJson);
  } catch {
    throw new Error(`Failed to parse contentJson for project ${projectId}`);
  }

  const projectResult = ProjectSchema.safeParse(rawProject);
  if (!projectResult.success) {
    throw new Error(`Project validation failed: ${projectResult.error.message}`);
  }

  const project = projectResult.data;
  const { widthPx, heightPx } = project.canvas;

  // 2. Solve dynamic layout coordinates
  const solved = solveLayout(project);
  
  const solvedProject = {
    ...project,
    layout: {
      ...project.layout,
      elements: solved.elements,
      score: solved.score,
      warnings: solved.warnings,
    },
  };

  // 3. Filter layout elements to only text-containing elements
  const textElements = solved.elements.filter((el) =>
    ['text', 'price', 'badge', 'footer', 'section_header'].includes(el.type)
  );

  const svgLines: string[] = [];

  for (const el of textElements) {
    // Fetch element text
    const text = getElementText(el, solvedProject);
    if (!text) continue;

    // Determine base font size
    let baseFontSize = el.style?.fontSize || 14;
    if (el.type === 'section_header' && !el.style?.fontSize) {
      baseFontSize = 28;
    }

    // Run fitText
    const fit = fitText(text, el.width, el.height, baseFontSize);
    const fontSize = fit.fontSize;

    // Style values matching OverlayRenderer
    const color = el.style?.color || solvedProject.brand.colors.primary;
    const fontFamily = el.style?.fontFamily || solvedProject.brand.fontPreferences.body;
    const fontWeight = el.style?.fontWeight || (el.type === 'section_header' ? 'bold' : 'normal');

    // Calculate vertical alignment
    const totalTextHeight = fit.lines.length * fontSize * 1.2;
    const startY = el.y + (el.height - totalTextHeight) / 2 + fontSize * 0.8;

    // Determine text alignment and text anchoring
    const textAlign = el.style?.textAlign || 'left';
    let x = el.x;
    let textAnchor = 'start';
    if (textAlign === 'center') {
      x = el.x + el.width / 2;
      textAnchor = 'middle';
    } else if (textAlign === 'right') {
      x = el.x + el.width;
      textAnchor = 'end';
    }

    // Generate <text> elements
    for (let idx = 0; idx < fit.lines.length; idx++) {
      const line = fit.lines[idx];
      const y = startY + idx * fontSize * 1.2;
      const escapedLine = escapeSvg(line);
      svgLines.push(
        `  <text x="${x}" y="${y}" font-family="${fontFamily}" font-size="${fontSize}px" font-weight="${fontWeight}" fill="${color}" text-anchor="${textAnchor}">${escapedLine}</text>`
      );
    }
  }

  // Wrap all text elements in svg tag
  const svgOutput = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${widthPx} ${heightPx}" width="${widthPx}" height="${heightPx}">`,
    ...svgLines,
    `</svg>`
  ].join('\n');

  return svgOutput;
}

function escapeSvg(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

