// Character width ratios and text fitting heuristics for layout estimation

// Average width-to-height ratio (factor of font size) for default sans-serif fonts
export const CHAR_WIDTH_RATIOS: Record<string, number> = {
  // Uppercase letters
  A: 0.65, B: 0.6, C: 0.65, D: 0.65, E: 0.55, F: 0.5, G: 0.7, H: 0.65, I: 0.25, J: 0.45,
  K: 0.6, L: 0.5, M: 0.8, N: 0.65, O: 0.7, P: 0.55, Q: 0.7, R: 0.6, S: 0.55, T: 0.55,
  U: 0.65, V: 0.65, W: 0.85, X: 0.6, Y: 0.6, Z: 0.55,
  // Lowercase letters
  a: 0.5, b: 0.5, c: 0.45, d: 0.5, e: 0.5, f: 0.3, g: 0.5, h: 0.5, i: 0.2, j: 0.2,
  k: 0.45, l: 0.2, m: 0.75, n: 0.5, o: 0.5, p: 0.5, q: 0.5, r: 0.35, s: 0.4, t: 0.3,
  u: 0.5, v: 0.45, w: 0.7, x: 0.45, y: 0.45, z: 0.4,
  // Digits
  '0': 0.55, '1': 0.55, '2': 0.55, '3': 0.55, '4': 0.55, '5': 0.55, '6': 0.55, '7': 0.55, '8': 0.55, '9': 0.55,
  // Special characters & punctuation
  ' ': 0.25, '.': 0.25, ',': 0.25, ';': 0.25, ':': 0.25, '!': 0.25, '?': 0.45,
  '-': 0.35, '_': 0.5, '+': 0.55, '=': 0.55, '*': 0.4, '/': 0.3, '\\': 0.3,
  '(': 0.35, ')': 0.35, '[': 0.35, ']': 0.35, '{': 0.35, '}': 0.35,
  '<': 0.55, '>': 0.55, '&': 0.6, '%': 0.75, '$': 0.55, '@': 0.8,
  '"': 0.35, "'": 0.2, '`': 0.3, '^': 0.4, '~': 0.55, '|': 0.25,
};

export const DEFAULT_CHAR_WIDTH_RATIO = 0.5;

/**
 * Estimates the width of a string at a given font size using character width ratios.
 */
export function estimateStringWidth(text: string, fontSize: number): number {
  let width = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const ratio = CHAR_WIDTH_RATIOS[char] !== undefined ? CHAR_WIDTH_RATIOS[char] : DEFAULT_CHAR_WIDTH_RATIO;
    width += ratio * fontSize;
  }
  return width;
}

/**
 * Wrap text into lines fitting within a maximum width.
 */
export function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  if (!text) return [];

  const paragraphs = text.split(/\r?\n/);
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/(\s+)/);
    let currentLine = '';

    for (const token of words) {
      if (token === '') continue;

      const testLine = currentLine + token;
      const testWidth = estimateStringWidth(testLine, fontSize);

      if (testWidth <= maxWidth || currentLine === '') {
        currentLine = testLine;
      } else {
        if (token.trim() === '') {
          lines.push(currentLine);
          currentLine = '';
        } else {
          lines.push(currentLine);
          currentLine = token;
        }
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines.map(line => line.trim()).filter(line => line.length > 0);
}

/**
 * Scales font size down (min 10px) and wraps text. Truncates with ellipsis if it overflows.
 */
export function fitText(
  text: string,
  maxWidth: number,
  maxHeight: number,
  baseFontSize: number,
  lineHeightRatio: number = 1.2
): { fontSize: number; isTruncated: boolean; lines: string[] } {
  let fontSize = baseFontSize;
  const minFontSize = 10;
  
  let lines: string[] = [];

  while (fontSize >= minFontSize) {
    lines = wrapText(text, maxWidth, fontSize);
    const totalHeight = lines.length * fontSize * lineHeightRatio;
    const allLinesFitWidth = lines.every(line => estimateStringWidth(line, fontSize) <= maxWidth);
    
    if (totalHeight <= maxHeight && allLinesFitWidth) {
      return { fontSize, isTruncated: false, lines };
    }
    
    fontSize--;
  }

  fontSize = minFontSize;
  lines = wrapText(text, maxWidth, fontSize);
  const lineHeight = fontSize * lineHeightRatio;
  const maxLinesAllowed = Math.max(1, Math.floor(maxHeight / lineHeight));
  let isTruncated = false;

  if (lines.length > maxLinesAllowed) {
    lines = lines.slice(0, maxLinesAllowed);
    isTruncated = true;
    
    const lastLineIndex = lines.length - 1;
    let lastLine = lines[lastLineIndex];
    const ellipsis = '...';
    let testLine = lastLine + ellipsis;
    while (lastLine.length > 0 && estimateStringWidth(testLine, fontSize) > maxWidth) {
      lastLine = lastLine.slice(0, -1);
      testLine = lastLine + ellipsis;
    }
    lines[lastLineIndex] = lastLine + ellipsis;
  }

  // Double check horizontal overflow for all lines (including single lines or earlier lines)
  for (let i = 0; i < lines.length; i++) {
    if (estimateStringWidth(lines[i], fontSize) > maxWidth) {
      isTruncated = true;
      let line = lines[i];
      const ellipsis = '...';
      let testLine = line + ellipsis;
      while (line.length > 0 && estimateStringWidth(testLine, fontSize) > maxWidth) {
        line = line.slice(0, -1);
        testLine = line + ellipsis;
      }
      lines[i] = line + ellipsis;
    }
  }

  return { fontSize, isTruncated, lines };
}
