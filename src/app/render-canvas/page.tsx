import { notFound } from 'next/navigation';
import { prisma, withDbRetry } from '@/lib/db';
import { ProjectSchema, mapPrismaAssetToZod, Project } from '@/lib/schemas/project';
import { solveLayout, getNumSlides } from '@/lib/layout/solver';
import { CanvasPreview } from '@/components/renderer/CanvasPreview';


export const dynamic = 'force-dynamic';

export default async function RenderCanvasPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; mode?: string }>;
}) {
  const { id, mode } = await searchParams;

  if (!id) {
    return notFound();
  }

  const projectRecord = await withDbRetry(() =>
    prisma.project.findUnique({
      where: { id },
    })
  );

  if (!projectRecord) {
    return notFound();
  }

  let rawProject: unknown;
  try {
    rawProject = JSON.parse(projectRecord.contentJson);
  } catch {
    return (
      <div style={{ padding: '20px', color: 'red' }}>
        Failed to parse project JSON.
      </div>
    );
  }

  const projectResult = ProjectSchema.safeParse(rawProject);
  if (!projectResult.success) {
    console.error(projectResult.error);
    return (
      <div style={{ padding: '20px', color: 'red' }}>
        Project failed validation: {projectResult.error.message}
      </div>
    );
  }

  const project: Project = projectResult.data;

  // Run the layout solver to get dynamic coordinates
  const solved = solveLayout(project);

  const solvedProject: Project = {
    ...project,
    layout: {
      ...project.layout,
      elements: solved.elements,
      score: solved.score,
      warnings: solved.warnings,
    },
  };

  // Calculate referenced asset IDs
  const referencedIds = new Set<string>();
  if (project.polishedBackground?.assetId) {
    referencedIds.add(project.polishedBackground.assetId);
  }
  if (project.brand.logoAssetId) {
    referencedIds.add(project.brand.logoAssetId);
  }
  project.content.sections.forEach((section) => {
    section.items.forEach((item) => {
      if (item.imageAssetId) {
        referencedIds.add(item.imageAssetId);
      }
    });
  });

  // Fetch only referenced assets to render images properly
  const dbAssets = await withDbRetry(() =>
    prisma.asset.findMany({
      where: {
        id: {
          in: Array.from(referencedIds),
        },
      },
    })
  );
  const assets = dbAssets.map(mapPrismaAssetToZod);

  const showOverlay = mode === 'full' || mode === 'overlay';
  const showBackground = mode !== 'overlay';

  // Load Google Fonts dynamically based on brand settings
  const headingFont = project.brand.fontPreferences?.heading || 'Inter';
  const bodyFont = project.brand.fontPreferences?.body || 'Inter';
  const priceFont = project.brand.fontPreferences?.price || 'Inter';
  
  const uniqueFonts = Array.from(new Set([headingFont, bodyFont, priceFont]));
  
  return (
    <>
      <style>{`
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          overflow: hidden !important;
          background-color: transparent !important;
        }
      `}</style>
      {uniqueFonts.map((font) => (
        <link
          key={font}
          rel="stylesheet"
          href={`https://fonts.googleapis.com/css2?family=${encodeURIComponent(
            font
          )}:wght@400;500;700&display=swap`}
        />
      ))}
      {(() => {
        const numSlides = getNumSlides(solvedProject);
        const totalWidth = solvedProject.canvas.widthPx * numSlides;

        return (
          <div
            style={{
              margin: 0,
              padding: 0,
              overflow: 'hidden',
              width: `${totalWidth}px`,
              height: `${solvedProject.canvas.heightPx}px`,
            }}
          >
            <CanvasPreview
              project={solvedProject}
              assets={assets}
              zoom={1}
              showBackground={showBackground}
              showOverlay={showOverlay}
              isRenderMode={true}
            />
          </div>
        );
      })()}

    </>
  );
}
