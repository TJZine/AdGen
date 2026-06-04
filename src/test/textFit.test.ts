import { describe, it, expect } from 'vitest';
import { fitText } from '../lib/layout/textFit';

describe('fitText horizontal overflow truncation', () => {
  it('does not truncate text that fits within constraints', () => {
    const result = fitText('Hello World', 200, 50, 14);
    expect(result.isTruncated).toBe(false);
    expect(result.lines).toEqual(['Hello World']);
    expect(result.fontSize).toBe(14);
  });

  it('scales down font size to make text fit without truncation if possible', () => {
    // FittingText (11 chars).
    // At size 20: 11 * 0.5 * 20 = 110 px (does not fit in maxWidth=70).
    // At size 12: 11 * 0.5 * 12 = 66 px (fits in maxWidth=70).
    const result = fitText('FittingText', 70, 50, 20);
    expect(result.isTruncated).toBe(false);
    expect(result.lines).toEqual(['FittingText']);
    expect(result.fontSize).toBeLessThan(20);
    expect(result.fontSize).toBeGreaterThanOrEqual(10);
  });

  it('truncates single-line text and appends ellipsis if it exceeds maxWidth even at min font size 10', () => {
    // "Supercalifragilisticexpialidocious" is 34 characters.
    // At min font size 10, width is 34 * 0.5 * 10 = 170.
    // If maxWidth is 80, it will not fit and must truncate with "...".
    const result = fitText('Supercalifragilisticexpialidocious', 80, 50, 14);
    expect(result.isTruncated).toBe(true);
    expect(result.fontSize).toBe(10);
    expect(result.lines.length).toBe(1);
    expect(result.lines[0].endsWith('...')).toBe(true);
    expect(result.lines[0].length).toBeLessThan(34);
  });

  it('truncates multiline text lines that exceed maxWidth even at min font size 10', () => {
    // First line is long, second is short, first line should be truncated
    const text = 'Supercalifragilisticexpialidocious\nShort';
    const result = fitText(text, 80, 100, 14);
    expect(result.isTruncated).toBe(true);
    expect(result.fontSize).toBe(10);
    expect(result.lines.length).toBe(2);
    expect(result.lines[0].endsWith('...')).toBe(true);
    expect(result.lines[1]).toBe('Short');
  });

  it('correctly handles zero or negative maxWidth and maxHeight by clamping', () => {
    const result = fitText('Hello World', -10, 0, 14);
    expect(result.fontSize).toBe(10);
    expect(result.isTruncated).toBe(true);
  });

  it('correctly handles huge base font size using binary search efficiently', () => {
    const result = fitText('Short text', 200, 100, 1000);
    expect(result.fontSize).toBeGreaterThanOrEqual(10);
    expect(result.fontSize).toBeLessThanOrEqual(1000);
    expect(result.isTruncated).toBe(false);
  });
});
