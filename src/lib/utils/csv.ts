import { randomUUID } from 'crypto';
import { Section, Item, SectionPriority, SectionLayoutHint, ItemPriority, VisibilityMode } from '../schemas/project';
import { formatCurrency } from './formatters';

export function sanitizeSpreadsheetFormula(value: string): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (trimmed.startsWith('=') || trimmed.startsWith('+') || trimmed.startsWith('-') || trimmed.startsWith('@')) {
    return `'${value}`;
  }
  return value;
}

function generateId(): string {
  try {
    return randomUUID();
  } catch {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}

/**
 * Parses a single CSV or TSV line, taking care of quoted values and escaped quotes.
 */
export function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let i = 0;
  
  while (i < line.length) {
    let inQuotes = false;
    let field = '';
    
    while (i < line.length) {
      const char = line[i];
      if (char === '\\' && line[i + 1] === '"') {
        field += '"';
        i += 2;
      } else if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === delimiter && !inQuotes) {
        i++; // skip delimiter
        break;
      } else {
        field += char;
        i++;
      }
    }
    result.push(field.trim());
  }

  // If the line ended with a delimiter, add an empty field at the end
  if (line.length > 0 && line[line.length - 1] === delimiter) {
    result.push('');
  }

  return result;
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[\s\-_]/g, '');
}

export function cleanHtml(value: unknown): string {
  if (typeof value !== 'string') return '';
  
  // Replace <br>, <br/>, <br /> with newline
  let text = value.replace(/<br\s*\/?>/gi, '\n');
  
  // Replace list items <li> with bullet points
  text = text.replace(/<li>/gi, '• ');
  text = text.replace(/<\/li>/gi, '\n');
  
  // Replace block closing tags with newline
  text = text.replace(/<\/p>|<\/h[1-6]>|<\/div>|<\/tr>/gi, '\n');
  
  // Replace table cells with spaces/tabs
  text = text.replace(/<\/td>|<\/th>/gi, ' ');
  
  // Strip HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, '');
  
  // Strip all other HTML tags safely (avoiding math comparison operators)
  text = text.replace(/<\/?[a-zA-Z][^>]*>/g, '');
  
  // Decode HTML entities
  text = text
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&lsquo;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&copy;/g, '©')
    .replace(/&reg;/g, '®')
    .replace(/&trade;/g, '™');

  // Decode numeric character references (decimal and hexadecimal)
  text = text.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
  text = text.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  // Normalize curly quotes to straight quotes
  text = text.replace(/[‘’]/g, "'");
  text = text.replace(/[“”]/g, '"');

  // Collapse consecutive spaces (excluding newlines)
  text = text.replace(/[ \t]+/g, ' ');

  // Normalize consecutive newlines and carriage returns
  text = text.replace(/\r/g, '');
  text = text.replace(/\n{3,}/g, '\n\n');
  
  // Trim spaces around lines but preserve structure
  text = text.split('\n').map(line => line.trim()).join('\n');

  return text.trim();
}

const headerMap: Record<string, string> = {
  section: 'section',
  category: 'section',
  categories: 'section', // WooCommerce
  group: 'section',
  title: 'title',
  name: 'title',
  subtitle: 'subtitle',
  shortdescription: 'subtitle', // WooCommerce
  description: 'description',
  desc: 'description',
  price: 'price',
  regularprice: 'price', // WooCommerce
  saleprice: 'salePrice',
  salepricedisplay: 'salePrice',
  badge: 'badge',
  image: 'image',
  images: 'image', // WooCommerce
  imagepath: 'image',
  imageurl: 'image',
  priority: 'priority',
  tags: 'tags',
};

/**
 * Parses raw spreadsheet text (CSV or TSV format), groups rows into sections,
 * and maps items to standard Item configurations.
 */
export function parseSpreadsheet(rawText: string): { sections: Section[]; items: Item[] } {
  if (!rawText || !rawText.trim()) {
    return { sections: [], items: [] };
  }

  // Detect delimiter using the first line
  const firstLine = rawText.split(/\r?\n/)[0] || '';
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const delimiter = tabCount > commaCount ? '\t' : ',';

  // State-machine parser to handle quoted newlines
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  
  for (let i = 0; i < rawText.length; i++) {
    const char = rawText[i];
    const nextChar = rawText[i + 1];

    if (char === '\\' && nextChar === '"') {
      currentField += '"';
      i++; // skip next char
    } else if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip \n
      }
      currentRow.push(currentField.trim());
      if (currentRow.some(val => val.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }
  
  // Push remaining field & row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some(val => val.length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length === 0) {
    return { sections: [], items: [] };
  }

  const headers = rows[0].map(h => normalizeHeader(h));

  const items: Item[] = [];
  const sectionMap = new Map<string, Section>();
  let sectionOrder = 0;

  for (let i = 1; i < rows.length; i++) {
    const rowValues = rows[i];
    
    // Create record matching headers
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      const mappedField = headerMap[header] || header;
      record[mappedField] = rowValues[index] || '';
    });

    // Skip if there's no title
    if (!record.title) {
      continue;
    }

    // Get or create section
    const sectionTitle = sanitizeSpreadsheetFormula(cleanHtml(record.section || 'Uncategorized'));
    let section = sectionMap.get(sectionTitle);
    if (!section) {
      const sectionId = generateId();
      section = {
        id: sectionId,
        title: sectionTitle,
        subtitle: '',
        priority: 'normal' as SectionPriority,
        layoutHint: 'grid' as SectionLayoutHint,
        order: sectionOrder++,
        items: [],
      };
      sectionMap.set(sectionTitle, section);
    }

    // Parse price
    let price: number | null = null;
    if (record.price) {
      const cleanPrice = record.price.replace(/[^\d.]/g, '');
      const parsedPrice = parseFloat(cleanPrice);
      if (!isNaN(parsedPrice)) {
        price = parsedPrice;
      }
    }

    // Parse sale price
    let salePrice: number | null = null;
    if (record.salePrice) {
      const cleanSalePrice = record.salePrice.replace(/[^\d.]/g, '');
      const parsedSalePrice = parseFloat(cleanSalePrice);
      if (!isNaN(parsedSalePrice)) {
        salePrice = parsedSalePrice;
      }
    }

    // Determine priority
    let priority: ItemPriority = 'normal';
    const rawPriority = (record.priority || '').toLowerCase().trim();
    if (rawPriority === 'hero') priority = 'hero';
    else if (rawPriority === 'featured') priority = 'featured';
    else if (rawPriority === 'compact') priority = 'compact';

    // Parse tags
    let tags: string[] = [];
    if (record.tags) {
      tags = record.tags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);
    }

    // Map image
    let imageVal = record.image || null;
    if (imageVal) {
      // WooCommerce Images column can be a comma-separated list of URLs
      imageVal = imageVal.split(',')[0].trim();
    }

    const item: Item = {
      id: generateId(),
      sectionId: section.id,
      title: sanitizeSpreadsheetFormula(cleanHtml(record.title)),
      subtitle: sanitizeSpreadsheetFormula(cleanHtml(record.subtitle || '')),
      description: sanitizeSpreadsheetFormula(cleanHtml(record.description || '')),
      price,
      priceDisplay: formatCurrency(price),
      salePrice,
      badge: record.badge ? sanitizeSpreadsheetFormula(cleanHtml(record.badge)) : null,
      imageAssetId: imageVal, // map filePath directly to imageAssetId
      priority,
      visibility: 'visible' as VisibilityMode,
      layoutHints: {
        cardSize: 'normal',
        imageFit: 'contain',
        preferredAspectRatio: '4:3',
      },
      metadata: {
        tags: tags.map(t => sanitizeSpreadsheetFormula(cleanHtml(t))),
      },
    };

    section.items.push(item);
    items.push(item);
  }

  return {
    sections: Array.from(sectionMap.values()),
    items,
  };
}
