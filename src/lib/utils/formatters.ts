/**
 * Formats a numeric price into a US currency string.
 * If value has no decimals, it will omit them (e.g. $530).
 * If value has decimals, it will show up to 2 decimal places (e.g. $5.50).
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '';
  }
  const hasCents = value % 1 !== 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(value);
}
