import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { PUT } from '@/app/api/projects/[id]/route';
import { prisma } from '@/lib/db';
import type { Project } from '@/lib/schemas/project';

vi.mock('@/lib/db', () => ({
  prisma: {
    project: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
  },
  withDbRetry: vi.fn((fn) => fn()),
}));


function projectFixture(id: string): Project {
  const now = new Date().toISOString();

  return {
    id,
    name: 'Route Test Project',
    schemaVersion: '1.0.0',
    type: 'inventory_board',
    canvas: {
      id: 'letter',
      name: 'Letter',
      widthPx: 2550,
      heightPx: 3300,
      dpi: 300,
      safeMarginPx: 120,
      unit: 'in',
    },
    brand: {
      id: `brand_${id}`,
      brandName: 'Route Test Brand',
      logoAssetId: null,
      website: '',
      phone: '',
      email: '',
      defaultFooter: '',
      defaultDisclaimer: '',
      colors: {
        background: '#FFFFFF',
        primary: '#000000',
        secondary: '#4A5568',
        muted: '#CBD5E0',
      },
      styleKeywords: [],
      fontPreferences: {
        heading: 'Inter',
        body: 'Inter',
        price: 'Inter',
      },
    },
    content: {
      headline: 'Weekly Specials',
      subheadline: '',
      sections: [],
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
      finalFormats: ['png', 'pdf'],
    },
    polishedBackground: {
      assetId: null,
      fitMode: 'cover',
      offsetX: 0,
      offsetY: 0,
      scale: 1,
      opacity: 1,
      legibilityPreset: 'none',
    },
    createdAt: now,
    updatedAt: now,
    layoutVariants: [],
    activeVariantId: null,
  };
}

function putRequest(project: Project) {
  return new NextRequest(`http://localhost:3000/api/projects/${project.id}`, {
    method: 'PUT',
    body: JSON.stringify(project),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

describe('project update route', () => {
  beforeEach(() => {
    vi.mocked(prisma.project.findUnique).mockReset();
    vi.mocked(prisma.project.updateMany).mockReset();
    vi.unstubAllEnvs();
    vi.stubEnv('ADGEN_AUTH_SECRET', '');
  });

  it('rejects mismatched route and body project ids before reading or updating storage', async () => {
    const bodyProject = projectFixture('project_body');
    const response = await PUT(putRequest(bodyProject), {
      params: Promise.resolve({ id: 'project_route' }),
    });

    await expect(response.json()).resolves.toEqual({
      error: 'Project ID mismatch between route and request body',
    });
    expect(response.status).toBe(400);
    expect(prisma.project.findUnique).not.toHaveBeenCalled();
    expect(prisma.project.updateMany).not.toHaveBeenCalled();
  });

  it('persists only validated project data for matching route and body ids', async () => {
    const project = projectFixture('project_route');
    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce({
      id: project.id,
      ownerId: 'dev_user',
    } as never);
    vi.mocked(prisma.project.updateMany).mockResolvedValueOnce({ count: 1 } as never);

    const response = await PUT(putRequest(project), {
      params: Promise.resolve({ id: project.id }),
    });

    expect(response.status).toBe(200);
    expect(prisma.project.updateMany).toHaveBeenCalledTimes(1);
    const updateArgs = vi.mocked(prisma.project.updateMany).mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: project.id });
    expect(updateArgs.data).toEqual(expect.objectContaining({
      name: project.name,
      type: project.type,
    }));
    expect(JSON.parse(updateArgs.data.contentJson as string)).toEqual(project);
  });

  it('allows a non-admin owner to update their own project atomically', async () => {
    vi.stubEnv('ADGEN_DEV_USER_ID', 'user_123');
    vi.stubEnv('ADGEN_DEV_USER_ROLE', 'user');

    const project = projectFixture('project_route');
    vi.mocked(prisma.project.findUnique).mockResolvedValueOnce({
      id: project.id,
      ownerId: 'user_123',
    } as never);
    vi.mocked(prisma.project.updateMany).mockResolvedValueOnce({ count: 1 } as never);

    const response = await PUT(putRequest(project), {
      params: Promise.resolve({ id: project.id }),
    });

    expect(response.status).toBe(200);
    expect(prisma.project.updateMany).toHaveBeenCalledWith({
      where: { id: project.id, ownerId: 'user_123' },
      data: expect.objectContaining({
        name: project.name,
        type: project.type,
      }),
    });
  });

  it('returns forbidden when a non-admin loses ownership between check and update', async () => {
    vi.stubEnv('ADGEN_DEV_USER_ID', 'user_123');
    vi.stubEnv('ADGEN_DEV_USER_ROLE', 'user');

    const project = projectFixture('project_route');
    vi.mocked(prisma.project.findUnique)
      .mockResolvedValueOnce({
        id: project.id,
        ownerId: 'user_123',
      } as never)
      .mockResolvedValueOnce({
        id: project.id,
      } as never);
    vi.mocked(prisma.project.updateMany).mockResolvedValueOnce({ count: 0 } as never);

    const response = await PUT(putRequest(project), {
      params: Promise.resolve({ id: project.id }),
    });

    await expect(response.json()).resolves.toEqual({
      error: 'Forbidden: You do not own this project',
    });
    expect(response.status).toBe(403);
    expect(prisma.project.updateMany).toHaveBeenCalledWith({
      where: { id: project.id, ownerId: 'user_123' },
      data: expect.any(Object),
    });
  });

  it('returns not found when a project disappears between ownership check and update', async () => {
    const project = projectFixture('project_route');
    vi.mocked(prisma.project.findUnique)
      .mockResolvedValueOnce({
        id: project.id,
        ownerId: 'dev_user',
      } as never)
      .mockResolvedValueOnce(null);
    vi.mocked(prisma.project.updateMany).mockResolvedValueOnce({ count: 0 } as never);

    const response = await PUT(putRequest(project), {
      params: Promise.resolve({ id: project.id }),
    });

    await expect(response.json()).resolves.toEqual({
      error: `Project with ID ${project.id} not found`,
    });
    expect(response.status).toBe(404);
  });
});
