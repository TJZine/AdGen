import { describe, it, expect } from 'vitest';
import { parseCSVLine, parseSpreadsheet, cleanHtml } from '../lib/utils/csv';
import { formatCurrency } from '../lib/utils/formatters';
import { mapPrismaAssetToZod, BrandColorsSchema } from '../lib/schemas/project';
import { Asset as PrismaAsset } from '@prisma/client';

describe('CSV Line Tokenizer', () => {
  it('should split simple values by comma', () => {
    const line = 'a,b,c';
    expect(parseCSVLine(line, ',')).toEqual(['a', 'b', 'c']);
  });

  it('should handle quoted values containing commas', () => {
    const line = 'a,"b,c",d';
    expect(parseCSVLine(line, ',')).toEqual(['a', 'b,c', 'd']);
  });

  it('should handle escaped double quotes', () => {
    const line = 'a,"b""c",d';
    expect(parseCSVLine(line, ',')).toEqual(['a', 'b"c', 'd']);
  });

  it('should handle backslash-escaped double quotes', () => {
    const line = 'a,"b\\"c",d';
    expect(parseCSVLine(line, ',')).toEqual(['a', 'b"c', 'd']);
  });

  it('should handle empty columns', () => {
    const line = 'a,,c,';
    expect(parseCSVLine(line, ',')).toEqual(['a', '', 'c', '']);
  });
});

describe('Spreadsheet Parser', () => {
  it('should parse standard CSV format correctly', () => {
    const csv = `section,title,subtitle,price,sale_price,badge,image,priority,tags
Compact,Shield Plus,9mm,$530,,NEW,images/shield.jpg,normal,"compact,9mm"`;
    
    const result = parseSpreadsheet(csv);
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].title).toBe('Compact');
    expect(result.items).toHaveLength(1);
    
    const item = result.items[0];
    expect(item.title).toBe('Shield Plus');
    expect(item.subtitle).toBe('9mm');
    expect(item.price).toBe(530);
    expect(item.priceDisplay).toBe('$530');
    expect(item.salePrice).toBeNull();
    expect(item.badge).toBe('NEW');
    expect(item.imageAssetId).toBe('images/shield.jpg');
    expect(item.priority).toBe('normal');
    expect(item.metadata.tags).toEqual(['compact', '9mm']);
  });

  it('should parse TSV format correctly', () => {
    const tsv = `section\ttitle\tprice\tpriority
Range\tSig P322\t$400\theero`; // checking invalid priority fallback
    const result = parseSpreadsheet(tsv);
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].title).toBe('Range');
    expect(result.items).toHaveLength(1);
    
    const item = result.items[0];
    expect(item.title).toBe('Sig P322');
    expect(item.price).toBe(400);
    expect(item.priority).toBe('normal'); // fallback because 'heero' is invalid
  });

  it('should normalize header variations', () => {
    const csv = `Category,Name,sale price
Compact,Shield Plus,499.99`;
    const result = parseSpreadsheet(csv);
    expect(result.items).toHaveLength(1);
    const item = result.items[0];
    expect(item.title).toBe('Shield Plus');
    expect(item.salePrice).toBe(499.99);
  });

  it('should map saleprice_display and sale_price headers correctly', () => {
    const csv = `section,title,price,saleprice_display,sale_price
Compact,Glock 19,550,499.99,499.99`;
    const result = parseSpreadsheet(csv);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].price).toBe(550);
    expect(result.items[0].salePrice).toBe(499.99);
  });

  it('should handle quoted newlines spanning multiple lines', () => {
    const csv = `section,title,description,price
Compact,Glock 19,"Compact 9mm pistol.
Includes 2 magazines.",550`;
    const result = parseSpreadsheet(csv);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].description).toBe(`Compact 9mm pistol.\nIncludes 2 magazines.`);
    expect(result.items[0].price).toBe(550);
  });

  it('should parse WooCommerce CSV fields and map headers correctly', () => {
    const csv = `Categories,Name,Short description,Description,Regular price,Sale price,Images,Tags
Handguns,"Walther PDP Steel Frame Pro Full Size 4.5in 9mm 10rd","<p>Short desc</p>","<p>Long description</p>",2199.00,1830.00,"url1.jpg,url2.jpg","9mm, Competition"`;
    
    const result = parseSpreadsheet(csv);
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].title).toBe('Handguns');
    expect(result.items).toHaveLength(1);
    
    const item = result.items[0];
    expect(item.title).toBe('Walther PDP Steel Frame Pro Full Size 4.5in 9mm 10rd');
    expect(item.subtitle).toBe('Short desc');
    expect(item.description).toBe('Long description');
    expect(item.price).toBe(2199.00);
    expect(item.salePrice).toBe(1830.00);
    expect(item.imageAssetId).toBe('url1.jpg');
    expect(item.metadata.tags).toEqual(['9mm', 'Competition']);
  });
});

describe('HTML Cleaning', () => {
  it('should strip HTML tags and decode entities', () => {
    const raw = '<p>The Walther PDP Steel Frame Pro Full Size 4.5&quot; 9mm is built for shooters &amp; competitors.</p>';
    expect(cleanHtml(raw)).toBe('The Walther PDP Steel Frame Pro Full Size 4.5" 9mm is built for shooters & competitors.');
  });

  it('should format lists and newlines correctly', () => {
    const raw = '<h3>Key Features</h3><ul><li>Feature 1</li><li>Feature 2</li></ul>';
    expect(cleanHtml(raw)).toBe('Key Features\n• Feature 1\n• Feature 2');
  });

  it('should handle complex table markup by removing it', () => {
    const raw = '<table><tr><td>Manufacturer</td><td>Walther</td></tr></table>';
    expect(cleanHtml(raw)).toBe('Manufacturer Walther');
  });

  it('should not strip mathematical comparisons', () => {
    expect(cleanHtml('price < 50 and caliber > 9mm')).toBe('price < 50 and caliber > 9mm');
  });

  it('should strip HTML comments', () => {
    expect(cleanHtml('hello <!-- comment --> world')).toBe('hello world');
  });

  it('should decode numeric character references (decimal and hex)', () => {
    expect(cleanHtml('A&#8217;s and B&#x2013;C')).toBe("A's and B–C");
  });

  it('should decode extra named entities', () => {
    expect(cleanHtml('a &ndash; b &copy; &reg;')).toBe('a – b © ®');
  });

  it('should return empty string for non-string inputs', () => {
    expect(cleanHtml(null)).toBe('');
    expect(cleanHtml(undefined)).toBe('');
    expect(cleanHtml(123)).toBe('');
  });
});

describe('Currency Formatter', () => {
  it('should format integer currency without decimals', () => {
    expect(formatCurrency(530)).toBe('$530');
  });

  it('should format float currency with decimals', () => {
    expect(formatCurrency(5.5)).toBe('$5.50');
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
  });

  it('should handle null and undefined', () => {
    expect(formatCurrency(null)).toBe('');
    expect(formatCurrency(undefined)).toBe('');
  });
});

describe('Zod Schema and Mappers', () => {
  it('should validate 3, 6, and 8 character hex colors', () => {
    const validColors = [
      { background: '#FFF', primary: '#000', secondary: '#F00', muted: '#AAA' },
      { background: '#FFFFFF', primary: '#000000', secondary: '#FF0000', muted: '#AAAAAA' },
      { background: '#FFFFFFFF', primary: '#000000FF', secondary: '#FF000088', muted: '#AAAAAA55' },
    ];

    for (const colors of validColors) {
      const parsed = BrandColorsSchema.safeParse(colors);
      expect(parsed.success).toBe(true);
    }

    const invalidColors = [
      { background: 'FFF', primary: '#000', secondary: '#F00', muted: '#AAA' },
      { background: '#FFFF', primary: '#000', secondary: '#F00', muted: '#AAA' },
      { background: '#GGGGGG', primary: '#000', secondary: '#F00', muted: '#AAA' },
    ];

    for (const colors of invalidColors) {
      const parsed = BrandColorsSchema.safeParse(colors);
      expect(parsed.success).toBe(false);
    }
  });

  it('should map a Prisma asset to Zod asset correctly', () => {
    const dbAsset: PrismaAsset = {
      id: 'asset_test',
      name: 'Test Image',
      type: 'image',
      filePath: 'uploads/test.png',
      mimeType: 'image/png',
      sizeBytes: 5000,
      width: 800,
      height: 600,
      focalPointX: 0.4,
      focalPointY: 0.6,
      createdAt: new Date('2026-06-02T12:00:00Z'),
      updatedAt: new Date('2026-06-02T12:30:00Z'),
    };

    const zodAsset = mapPrismaAssetToZod(dbAsset);
    expect(zodAsset.id).toBe('asset_test');
    expect(zodAsset.name).toBe('Test Image');
    expect(zodAsset.type).toBe('image');
    expect(zodAsset.filePath).toBe('uploads/test.png');
    expect(zodAsset.thumbnailPath).toBeNull();
    expect(zodAsset.mimeType).toBe('image/png');
    expect(zodAsset.sizeBytes).toBe(5000);
    expect(zodAsset.dimensions).toEqual({ width: 800, height: 600 });
    expect(zodAsset.focalPoint).toEqual({ x: 0.4, y: 0.6 });
    expect(zodAsset.createdAt).toBe('2026-06-02T12:00:00.000Z');
    expect(zodAsset.updatedAt).toBe('2026-06-02T12:30:00.000Z');
  });
});
