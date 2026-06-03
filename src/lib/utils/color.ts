/**
 * Parses a hex color string (e.g. #FFF or #FFFFFF) to its RGB components.
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  if (!hex) return { r: 0, g: 0, b: 0 };
  const cleanHex = hex.replace('#', '');
  const safeValue = (value: number) => Number.isNaN(value) ? 0 : value;

  if (cleanHex.length === 3) {
    return {
      r: safeValue(parseInt(cleanHex[0] + cleanHex[0], 16)),
      g: safeValue(parseInt(cleanHex[1] + cleanHex[1], 16)),
      b: safeValue(parseInt(cleanHex[2] + cleanHex[2], 16)),
    };
  }
  if (cleanHex.length === 6 || cleanHex.length === 8) {
    return {
      r: safeValue(parseInt(cleanHex.substring(0, 2), 16)),
      g: safeValue(parseInt(cleanHex.substring(2, 4), 16)),
      b: safeValue(parseInt(cleanHex.substring(4, 6), 16)),
    };
  }
  return { r: 0, g: 0, b: 0 };
}

/**
 * Calculates the relative luminance of an RGB color.
 */
export function getRelativeLuminance(r: number, g: number, b: number): number {
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

/**
 * Determines whether a color is dark using the YIQ formula.
 */
export function isDarkColor(hex: string): boolean {
  if (!hex) return true;
  const { r, g, b } = hexToRgb(hex);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq < 128;
}
