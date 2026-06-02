import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { EditorWorkspace } from '@/components/editor/EditorWorkspace';
import { Project, Asset, mapPrismaAssetToZod } from '@/lib/schemas/project';

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
    project = JSON.parse(dbProject.contentJson) as Project;
  } catch (error) {
    console.error(`Failed to parse project contentJson for ID ${id}:`, error);
    notFound();
  }

  // Fetch all assets
  const dbAssets = await prisma.asset.findMany();
  const assets: Asset[] = dbAssets.map(mapPrismaAssetToZod);

  return (
    <EditorWorkspace initialProject={project} initialAssets={assets} />
  );
}
