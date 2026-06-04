import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/export/render/route';
import { NextRequest } from 'next/server';
import { renderLayoutPng } from '@/lib/export/renderService';
import { prisma } from '@/lib/db';

vi.mock('@/lib/db', () => ({
  prisma: {
    project: {
      findUnique: vi.fn(),
    },
  },
  withDbRetry: vi.fn((fn) => fn()),
}));

vi.mock('@/lib/export/renderService', () => ({
  renderLayoutPng: vi.fn(),
}));

describe('Export Render API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 if project id is missing', async () => {
    const req = new NextRequest('http://localhost:3000/api/export/render?mode=full');
    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Missing required parameter');
  });

  it('returns 400 if mode is invalid', async () => {
    const req = new NextRequest('http://localhost:3000/api/export/render?id=123&mode=invalid');
    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Invalid mode parameter');
  });

  it('returns 200 with PNG buffer on success', async () => {
    const fakeBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG signature
    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce({
      id: 'uuid-123',
      ownerId: 'dev_user',
    } as unknown as import('@prisma/client').Project);
    vi.mocked(renderLayoutPng).mockResolvedValueOnce(fakeBuffer);

    const req = new NextRequest('http://localhost:3000/api/export/render?id=uuid-123&mode=full');
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
    expect(res.headers.get('Content-Length')).toBe(fakeBuffer.length.toString());
  });

  it('returns 500 if rendering service fails', async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce({
      id: 'uuid-123',
      ownerId: 'dev_user',
    } as unknown as import('@prisma/client').Project);
    vi.mocked(renderLayoutPng).mockRejectedValueOnce(new Error('Playwright timeout'));

    const req = new NextRequest('http://localhost:3000/api/export/render?id=uuid-123&mode=full');
    const res = await GET(req);

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('Playwright timeout');
  });

  it('returns 404 if project is not found', async () => {
    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce(null);

    const req = new NextRequest('http://localhost:3000/api/export/render?id=uuid-123&mode=full');
    const res = await GET(req);

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('Project with ID uuid-123 not found');
  });
});
