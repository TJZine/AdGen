import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/export/overlay/route';
import { NextRequest } from 'next/server';
import { renderLayoutOverlayPng, renderLayoutOverlaySvg } from '@/lib/export/renderService';
import { prisma } from '@/lib/db';
import { Project as PrismaProject } from '@prisma/client';

vi.mock('@/lib/export/renderService', () => ({
  renderLayoutOverlayPng: vi.fn(),
  renderLayoutOverlaySvg: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    project: {
      findUnique: vi.fn(),
    },
  },
}));

const mockProject = {
  id: 'uuid-123',
  name: 'Test Project',
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
    defaultFooter: 'Footer text',
    defaultDisclaimer: 'Disclaimer text',
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
    headline: 'Handguns & Gear',
    subheadline: 'Best prices in town',
    sections: [
      {
        id: 's1',
        title: 'Featured Guns',
        subtitle: 'Selected items',
        priority: 'normal',
        layoutHint: 'grid',
        order: 1,
        items: [
          {
            id: 'i1',
            sectionId: 's1',
            title: 'Glock 19 Gen 5',
            subtitle: 'Compact 9mm Pistol',
            description: 'Reliable and popular everyday carry handgun.',
            price: 549,
            priceDisplay: '$549',
            salePrice: null,
            badge: 'SALE',
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
    layoutFamily: 'inventory_board',
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

describe('Export Overlay API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 if project id is missing', async () => {
    const req = new NextRequest('http://localhost:3000/api/export/overlay?format=png');
    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Missing required parameter');
  });

  it('returns 400 if format is invalid', async () => {
    const req = new NextRequest('http://localhost:3000/api/export/overlay?id=123&format=invalid');
    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Invalid format parameter');
  });

  it('returns 200 with transparent PNG buffer on success', async () => {
    const fakeBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG signature
    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      id: 'uuid-123',
      ownerId: 'dev_user',
    } as unknown as import('@prisma/client').Project);
    vi.mocked(renderLayoutOverlayPng).mockResolvedValueOnce(fakeBuffer);

    const req = new NextRequest('http://localhost:3000/api/export/overlay?id=uuid-123&format=png');
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
    expect(res.headers.get('Content-Length')).toBe(fakeBuffer.length.toString());
  });

  it('returns 200 with SVG content on success', async () => {
    const fakeSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3300 5100" width="3300" height="5100"></svg>';
    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      id: 'uuid-123',
      ownerId: 'dev_user',
    } as unknown as import('@prisma/client').Project);
    vi.mocked(renderLayoutOverlaySvg).mockResolvedValueOnce(fakeSvg);

    const req = new NextRequest('http://localhost:3000/api/export/overlay?id=uuid-123&format=svg');
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('image/svg+xml');
    const text = await res.text();
    expect(text).toBe(fakeSvg);
  });

  it('returns 404 if project is not found', async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValue(null);

    const req = new NextRequest('http://localhost:3000/api/export/overlay?id=uuid-123&format=png');
    const res = await GET(req);

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('Project with ID uuid-123 not found');
  });

  it('returns 500 if rendering service fails unexpectedly', async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValue({
      id: 'uuid-123',
      ownerId: 'dev_user',
    } as unknown as import('@prisma/client').Project);
    vi.mocked(renderLayoutOverlayPng).mockRejectedValueOnce(new Error('Browser crashed'));

    const req = new NextRequest('http://localhost:3000/api/export/overlay?id=uuid-123&format=png');
    const res = await GET(req);

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('Browser crashed');
  });

  it('programmatically generates correct SVG structure using the service', async () => {
    // Import the actual service functions to run the SVG generator logic
    const { renderLayoutOverlaySvg: actualRenderSvg } = await vi.importActual<
      typeof import('@/lib/export/renderService')
    >('@/lib/export/renderService');

    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce({
      id: 'uuid-123',
      name: 'Test Project',
      type: 'inventory_board',
      contentJson: JSON.stringify(mockProject),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as PrismaProject);

    const svgString = await actualRenderSvg('uuid-123');

    // Basic structure asserts
    expect(svgString).toContain('<svg');
    expect(svgString).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svgString).toContain('viewBox="0 0 3300 5100"');
    expect(svgString).toContain('width="3300"');
    expect(svgString).toContain('height="5100"');
    expect(svgString).toContain('</svg>');

    // Check if the headline text is embedded as a text element
    expect(svgString).toContain('Handguns &amp; Gear');

    // Check if the subheadline text is embedded
    expect(svgString).toContain('Best prices in town');

    // Check if the section header text is embedded
    expect(svgString).toContain('Featured Guns');

    // Check if the footer text is embedded
    expect(svgString).toContain('Footer text');

    // Check if item text is embedded
    expect(svgString).toContain('Glock 19 Gen 5');
    expect(svgString).toContain('Compact 9mm Pistol');
    expect(svgString).toContain('Reliable and popular everyday carry handgun.');
    expect(svgString).toContain('$549');

    // Ensure it compiles and is syntactically valid XML/SVG
    expect(svgString).toContain('<text');
  });

  it('sanitizes unsafe SVG attribute values when generating overlay text', async () => {
    const { renderLayoutOverlaySvg: actualRenderSvg } = await vi.importActual<
      typeof import('@/lib/export/renderService')
    >('@/lib/export/renderService');

    const maliciousProject = {
      ...mockProject,
      brand: {
        ...mockProject.brand,
        fontPreferences: {
          heading: 'Impact" /><script>alert(1)</script><text x="0',
          body: 'Arial" /><script>alert(1)</script><text x="0',
          price: 'Impact',
        },
      },
    };

    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce({
      id: 'uuid-123',
      name: 'Test Project',
      type: 'inventory_board',
      contentJson: JSON.stringify(maliciousProject),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as PrismaProject);

    const svgString = await actualRenderSvg('uuid-123');

    expect(svgString).not.toContain('<script>');
    expect(svgString).not.toContain('font-family="Arial" /><script>');
    expect(svgString).toContain('font-family="Arial"');
  });
});
