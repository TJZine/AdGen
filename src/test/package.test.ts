import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getClosestAspectRatio, compilePrompt, getNegativePrompt } from '@/lib/export/promptBuilder';
import { createHandoffPackage } from '@/lib/export/zipPackager';
import { GET } from '@/app/api/export/package/route';
import { NextRequest } from 'next/server';
import { renderLayoutImages } from '@/lib/export/renderService';
import { prisma } from '@/lib/db';
import { Project } from '@/lib/schemas/project';
import { Project as PrismaProject } from '@prisma/client';

vi.mock('@/lib/export/renderService', () => ({
  renderLayoutImages: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    project: {
      findUnique: vi.fn(),
    },
  },
  withDbRetry: vi.fn((fn) => fn()),
}));

const mockProject = {
  id: 'uuid-123',
  name: 'Test Handgun Project',
  type: 'inventory_board',
  canvas: {
    id: 'poster_11x17',
    name: 'Poster 11x17',
    widthPx: 3300,
    heightPx: 5100,
    dpi: 300,
    safeMarginPx: 120,
    unit: 'px',
  },
  brand: {
    id: 'brand-1',
    brandName: 'Tactical Shop',
    logoAssetId: null,
    website: 'https://tactical.com',
    phone: '555-0199',
    email: 'info@tactical.com',
    defaultFooter: 'Footer',
    defaultDisclaimer: 'Disclaimer',
    colors: {
      background: '#000000',
      primary: '#FF0000',
      secondary: '#FFFFFF',
      muted: '#888888',
    },
    styleKeywords: ['tactical', 'dark'],
    fontPreferences: {
      heading: 'Impact',
      body: 'Arial',
      price: 'Impact',
    },
  },
  content: {
    headline: 'Handguns',
    subheadline: 'Sub',
    sections: [
      {
        id: 's1',
        title: 'Section 1',
        subtitle: '',
        priority: 'normal',
        layoutHint: 'grid',
        order: 1,
        items: [
          {
            id: 'i1',
            sectionId: 's1',
            title: 'Glock 19',
            subtitle: '9mm',
            description: 'Pistol',
            price: 500,
            priceDisplay: '$500',
            salePrice: null,
            badge: 'NEW',
            imageAssetId: null,
            priority: 'normal',
            visibility: 'visible',
            layoutHints: {
              cardSize: 'normal',
              imageFit: 'contain',
              preferredAspectRatio: '4:3',
            },
            metadata: { tags: [] },
          },
        ],
      },
    ],
  },
  layout: {
    elements: [],
    layoutFamily: 'grid',
    density: 'normal',
    score: 100,
    warnings: [],
  },
  exportSettings: {
    exactTextOverlay: true,
    aiPolishMode: 'background_and_style',
    finalFormats: ['png'],
  },
  createdAt: '2026-06-02T00:00:00Z',
  updatedAt: '2026-06-02T00:00:00Z',
};

describe('Prompt Builder Helpers', () => {
  it('correctly returns closest aspect ratio', () => {
    // 3300 / 5100 = 0.647 -> matches 11:17
    expect(getClosestAspectRatio(3300, 5100)).toBe('11:17');
    // 1080 / 1080 = 1.0 -> matches 1:1
    expect(getClosestAspectRatio(1080, 1080)).toBe('1:1');
    // 1920 / 1080 = 1.777 -> matches 16:9
    expect(getClosestAspectRatio(1920, 1080)).toBe('16:9');
  });

  it('compiles prompt containing keywords and details', () => {
    const prompt = compilePrompt(mockProject as unknown as Project);
    expect(prompt).toContain('Tactical Shop');
    expect(prompt).toContain('tactical, dark');
    expect(prompt).toContain('--ar 11:17');
  });

  it('compiles standard negative prompt list', () => {
    const neg = getNegativePrompt();
    expect(neg).toContain('text');
    expect(neg).toContain('spelling');
  });
});

describe('ZIP Packager Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws error if project is not in database', async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce(null);

    await expect(createHandoffPackage('missing-id')).rejects.toThrow('not found');
  });

  it('generates a valid ZIP archive containing files', async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce({
      id: 'uuid-123',
      name: 'Test Handgun Project',
      type: 'inventory_board',
      contentJson: JSON.stringify(mockProject),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as PrismaProject);

    vi.mocked(renderLayoutImages).mockResolvedValue({
      full: Buffer.from('mock-png'),
      backgroundOnly: Buffer.from('mock-png'),
    });

    const zipBuffer = await createHandoffPackage('uuid-123');

    expect(zipBuffer).toBeDefined();
    // ZIP signature starts with 'PK\x03\x04' (hex: 50 4B 03 04)
    expect(zipBuffer[0]).toBe(0x50);
    expect(zipBuffer[1]).toBe(0x4b);
    expect(zipBuffer[2]).toBe(0x03);
    expect(zipBuffer[3]).toBe(0x04);
  });
});

describe('Export Package API Endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 if project id is missing', async () => {
    const req = new NextRequest('http://localhost:3000/api/export/package');
    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Missing required parameter');
  });

  it('returns 404 if project is not found', async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce(null);

    const req = new NextRequest('http://localhost:3000/api/export/package?id=missing-id');
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it('returns 200 with ZIP headers on success', async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      id: 'uuid-123',
      name: 'Test Handgun Project',
      type: 'inventory_board',
      contentJson: JSON.stringify(mockProject),
      createdAt: new Date(),
      updatedAt: new Date(),
      ownerId: 'dev_user',
    } as unknown as PrismaProject);
    vi.mocked(renderLayoutImages).mockResolvedValue({
      full: Buffer.from('mock-png'),
      backgroundOnly: Buffer.from('mock-png'),
    });

    const req = new NextRequest('http://localhost:3000/api/export/package?id=uuid-123');
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/zip');
    expect(res.headers.get('Content-Disposition')).toContain('attachment; filename="handoff-uuid-123.zip"');
  });
});
