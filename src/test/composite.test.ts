import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { fileTypeFromBuffer } from 'file-type';
import { POST } from '@/app/api/upload/route';
import { GET } from '@/app/api/export/pdf/route';
import { renderLayoutPdf } from '@/lib/export/renderService';
import { hexToRgb, getRelativeLuminance, isDarkColor } from '@/lib/utils/color';
import { prisma } from '@/lib/db';

// Mock file-type
vi.mock('file-type', () => ({
  fileTypeFromBuffer: vi.fn(),
}));

// Mock sharp
vi.mock('sharp', () => {
  const sharpMock = () => {
    const mockInstance = {
      rotate: vi.fn().mockReturnThis(),
      toFormat: vi.fn().mockReturnThis(),
      toBuffer: vi.fn().mockResolvedValue(Buffer.from('fake-optimized-image')),
      metadata: vi.fn().mockResolvedValue({ width: 800, height: 600 }),
    };
    return mockInstance;
  };
  return {
    default: sharpMock,
  };
});

// Mock database (prisma)
vi.mock('@/lib/db', () => ({
  prisma: {
    asset: {
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'uuid-mock', ...data })),
      delete: vi.fn().mockResolvedValue({ id: 'uuid-mock' }),
    },
    project: {
      findUnique: vi.fn(),
    },
  },
  withDbRetry: vi.fn((fn) => fn()),
}));


// Mock Playwright / renderService
vi.mock('@/lib/export/renderService', () => ({
  renderLayoutPdf: vi.fn(),
}));

describe('Composite & Background Import tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('File-type magic-bytes validation', () => {
    it('rejects upload if no file is provided', async () => {
      const req = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: new FormData(), // empty
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('No file provided');
    });

    it('rejects file if magic bytes are not detected as an image', async () => {
      vi.mocked(fileTypeFromBuffer).mockResolvedValueOnce(undefined);

      const formData = new FormData();
      formData.append('file', new Blob([Buffer.from('fake-data')], { type: 'text/plain' }), 'test.txt');

      const req = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData,
      });
      req.formData = async () => formData;

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Invalid file type. Only images are allowed.');
    });

    it('rejects file if image mime type is not supported', async () => {
      vi.mocked(fileTypeFromBuffer).mockResolvedValueOnce({ ext: 'gif', mime: 'image/gif' });

      const formData = new FormData();
      formData.append('file', new Blob([Buffer.from('fake-gif')], { type: 'image/gif' }), 'test.gif');

      const req = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData,
      });
      req.formData = async () => formData;

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('is not supported');
    });

    it('accepts file and creates asset on successful validation', async () => {
      vi.mocked(fileTypeFromBuffer).mockResolvedValueOnce({ ext: 'jpg', mime: 'image/jpeg' });

      const formData = new FormData();
      formData.append('file', new File([Buffer.from('fake-jpeg-data')], 'image.jpg', { type: 'image/jpeg' }));

      const req = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData,
      });
      req.formData = async () => formData;

      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.name).toBe('image.jpg');
      expect(data.mimeType).toBe('image/jpeg');
      expect(data.width).toBe(800);
      expect(data.height).toBe(600);
    });

    it('rejects file if content-length header exceeds 10MB', async () => {
      const formData = new FormData();
      formData.append('file', new File([Buffer.from('fake')], 'image.jpg', { type: 'image/jpeg' }));

      const req = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        headers: {
          'content-length': (11 * 1024 * 1024).toString(),
        },
        body: formData,
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('exceeds the 10MB limit');
    });

    it('rejects file if file.size exceeds 10MB', async () => {
      const largeFile = new File([new Uint8Array(11 * 1024 * 1024)], 'image.jpg', { type: 'image/jpeg' });
      const formData = new FormData();
      formData.append('file', largeFile);

      const req = new NextRequest('http://localhost:3000/api/upload', {
        method: 'POST',
        body: formData,
      });
      req.formData = async () => formData;

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('exceeds the 10MB limit');
    });
  });

  describe('ContrastGuard relative luminance and contrast ratio calculations', () => {
    it('converts hex colors to RGB correctly', () => {
      expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
      expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
      expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
      expect(hexToRgb('#FFF')).toEqual({ r: 255, g: 255, b: 255 });
      expect(hexToRgb('')).toEqual({ r: 0, g: 0, b: 0 });
    });

    it('falls back safely for malformed hex colors', () => {
      expect(hexToRgb('#GGG')).toEqual({ r: 0, g: 0, b: 0 });
      expect(hexToRgb('#ZZZZZZ')).toEqual({ r: 0, g: 0, b: 0 });
      expect(isDarkColor('#ZZZZZZ')).toBe(true);
    });

    it('calculates correct relative luminance', () => {
      // White luminance should be 1
      expect(getRelativeLuminance(255, 255, 255)).toBeCloseTo(1.0, 4);
      // Black luminance should be 0
      expect(getRelativeLuminance(0, 0, 0)).toBeCloseTo(0.0, 4);
      // Red (255,0,0) relative luminance is ~0.2126
      expect(getRelativeLuminance(255, 0, 0)).toBeCloseTo(0.2126, 4);
    });

    it('computes contrast ratio correctly', () => {
      const lWhite = getRelativeLuminance(255, 255, 255); // 1.0
      const lBlack = getRelativeLuminance(0, 0, 0); // 0.0
      
      // Contrast of white vs black should be (1.0 + 0.05) / (0.0 + 0.05) = 21
      const ratio = (lWhite + 0.05) / (lBlack + 0.05);
      expect(ratio).toBe(21.0);

      // Contrast of black vs black should be 1
      const ratioSelf = (lBlack + 0.05) / (lBlack + 0.05);
      expect(ratioSelf).toBe(1.0);
    });
  });

  describe('Export PDF route response and parameter validation', () => {
    it('returns 400 if project ID is missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/export/pdf');
      const res = await GET(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Missing required parameter');
    });

    it('returns 200 with PDF content headers on success', async () => {
      const fakePdfBuffer = Buffer.from('fake-pdf-content');
      vi.mocked(prisma.project.findUnique).mockResolvedValueOnce({
        id: 'project-uuid',
        ownerId: 'dev_user',
      } as unknown as import('@prisma/client').Project);
      vi.mocked(renderLayoutPdf).mockResolvedValueOnce(fakePdfBuffer);

      const req = new NextRequest('http://localhost:3000/api/export/pdf?id=project-uuid');
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('application/pdf');
      expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="flyer-project-uuid.pdf"');
      expect(res.headers.get('Content-Length')).toBe(fakePdfBuffer.length.toString());
    });

    it('returns 404 if project is not found', async () => {
      vi.mocked(prisma.project.findUnique).mockResolvedValueOnce(null);

      const req = new NextRequest('http://localhost:3000/api/export/pdf?id=project-uuid');
      const res = await GET(req);

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toBe('Project with ID project-uuid not found');
    });

    it('returns 500 on internal browser/rendering failure', async () => {
      vi.mocked(prisma.project.findUnique).mockResolvedValueOnce({
        id: 'project-uuid',
        ownerId: 'dev_user',
      } as unknown as import('@prisma/client').Project);
      vi.mocked(renderLayoutPdf).mockRejectedValueOnce(new Error('Playwright context failed'));

      const req = new NextRequest('http://localhost:3000/api/export/pdf?id=project-uuid');
      const res = await GET(req);

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toBe('Playwright context failed');
    });
  });
});
