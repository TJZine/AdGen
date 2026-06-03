import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { Project } from '@/lib/schemas/project';
import { authenticateSessionCookie, SESSION_COOKIE_NAME } from '@/lib/auth/server';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const currentUser = authenticateSessionCookie(cookieStore.get(SESSION_COOKIE_NAME)?.value);

  const projects = await prisma.project.findMany({
    where: !currentUser
      ? { id: '__unauthorized__' }
      : currentUser.role !== 'admin'
      ? { ownerId: currentUser.id }
      : undefined,
    orderBy: { updatedAt: 'desc' },
  });

  // Server Action to handle project creation
  async function createProject() {
    'use server';
    const actionCookieStore = await cookies();
    const actionUser = authenticateSessionCookie(actionCookieStore.get(SESSION_COOKIE_NAME)?.value);
    if (!actionUser) {
      throw new Error('Unauthorized');
    }

    const id = `project_${crypto.randomUUID()}`;
    
    const newProjectData: Project = {
      id,
      name: 'New Flyer Project',
      schemaVersion: '1.0.0',
      type: 'inventory_board',
      canvas: {
        id: 'letter',
        name: 'Letter (8.5" x 11")',
        widthPx: 2550,
        heightPx: 3300,
        dpi: 300,
        safeMarginPx: 120,
        unit: 'in',
      },
      brand: {
        id: `brand_${id}`,
        brandName: 'My Brand',
        logoAssetId: null,
        website: '',
        phone: '',
        email: '',
        defaultFooter: 'Thank you for shopping with us!',
        defaultDisclaimer: 'Offers valid while supplies last.',
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
        subheadline: 'Check out our featured items this week',
        sections: [
          {
            id: `sec_${id}_1`,
            title: 'Featured Products',
            subtitle: 'Best deals of the season',
            priority: 'normal',
            layoutHint: 'grid',
            order: 0,
            items: [
              {
                id: `item_${id}_1`,
                sectionId: `sec_${id}_1`,
                title: 'Sample Item 1',
                subtitle: '9mm',
                description: 'High quality sample product for testing layout design.',
                price: 499.99,
                priceDisplay: '$499.99',
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      layoutVariants: [],
      activeVariantId: null,
    };

    try {
      await prisma.project.create({
        data: {
          id,
          name: newProjectData.name,
          type: newProjectData.type,
          contentJson: JSON.stringify(newProjectData),
          ownerId: actionUser.id,
        },
      });
    } catch (error) {
      console.error('Failed to create new project:', error);
      throw error;
    }

    redirect(`/editor/${id}`);
  }

  return (
    <div className="min-h-screen bg-zinc-50 font-sans p-10 flex flex-col items-center">
      <main className="w-full max-w-4xl flex flex-col gap-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-zinc-950 tracking-tight">AdGen Flyer Editor</h1>
            <p className="text-sm text-zinc-500 mt-1">
              Create, manage, and layout inventory flyers using layout constraints.
            </p>
          </div>
          
          <div className="flex gap-3">
            <Link
              href="/editor/project_cfc_tactical_board"
              className="px-4 py-2 bg-white border border-zinc-300 rounded text-sm font-semibold hover:bg-zinc-100 text-zinc-800 transition"
            >
              Open Seeded Project
            </Link>
            <form action={createProject}>
              <button
                type="submit"
                className="px-4 py-2 bg-zinc-950 text-white rounded text-sm font-semibold hover:bg-zinc-800 transition"
              >
                Create New Project
              </button>
            </form>
          </div>
        </div>

        <hr className="border-zinc-200" />

        {/* Projects List */}
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-bold text-zinc-900">Projects Directory</h2>
          
          {projects.length === 0 ? (
            <div className="border border-dashed border-zinc-300 rounded-lg p-12 text-center bg-white">
              <span className="text-sm text-zinc-400 font-medium">No projects found.</span>
              <p className="text-xs text-zinc-400 mt-1">
                Click &quot;Create New Project&quot; or seed the database to get started.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projects.map((project) => {
                const lastUpdated = new Date(project.updatedAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });
                
                return (
                  <div
                    key={project.id}
                    className="border border-zinc-200 bg-white rounded-lg p-5 flex flex-col justify-between hover:shadow-md transition group"
                  >
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="font-bold text-zinc-900 group-hover:text-zinc-950 leading-tight">
                          {project.name}
                        </h3>
                        <span className="text-xxs px-2 py-0.5 rounded bg-zinc-100 border font-semibold text-zinc-500 uppercase tracking-wider">
                          {project.type.replace('_', ' ')}
                        </span>
                      </div>
                      <span className="text-xs text-zinc-500 font-mono">ID: {project.id}</span>
                      <span className="text-xs text-zinc-400 mt-1">Last edited: {lastUpdated}</span>
                    </div>

                    <div className="flex items-center justify-end gap-3 mt-6 border-t border-zinc-100 pt-3">
                      <Link
                        href={`/editor/${project.id}`}
                        className="text-xs font-bold text-zinc-950 hover:underline flex items-center gap-1"
                      >
                        Open Editor
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
