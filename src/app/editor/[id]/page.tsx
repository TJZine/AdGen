import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { EditorWorkspace } from '@/components/editor/EditorWorkspace';
import { Project, Asset, mapPrismaAssetToZod, ProjectSchema } from '@/lib/schemas/project';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditorPage({ params }: PageProps) {
  const { id } = await params;

  if (!id) {
    notFound();
  }

  const dbProject = await prisma.project.findUnique({
    where: { id },
  });

  if (!dbProject) {
    notFound();
  }

  let project: Project;
  try {
    const raw = JSON.parse(dbProject.contentJson);
    const parseResult = ProjectSchema.safeParse(raw);
    if (!parseResult.success) {
      console.error(`Failed to validate project content schema for ID ${id}:`, parseResult.error.format());
      notFound();
    }
    project = parseResult.data;
  } catch (error) {
    console.error(`Failed to parse/validate project contentJson for ID ${id}:`, error);
    notFound();
  }

  // Fetch all assets
  const dbAssets = await prisma.asset.findMany();
  const assets: Asset[] = dbAssets.map(mapPrismaAssetToZod);

  return (
    <EditorWorkspace initialProject={project} initialAssets={assets} />
  );
}
