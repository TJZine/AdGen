import { NextRequest, NextResponse } from 'next/server';
import { prisma, withDbRetry } from '@/lib/db';
import { ProjectSchema } from '@/lib/schemas/project';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth/server';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: 'Missing project ID' },
        { status: 400 }
      );
    }

    const user = authenticateRequest(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const body = await request.json();

    const parseResult = ProjectSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid project data', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const validatedProject = parseResult.data;
    if (validatedProject.id !== id) {
      return NextResponse.json(
        { error: 'Project ID mismatch between route and request body' },
        { status: 400 }
      );
    }

    const existingProject = await prisma.project.findUnique({
      where: { id },
      select: { id: true, ownerId: true },
    });

    if (!existingProject) {
      return NextResponse.json(
        { error: `Project with ID ${id} not found` },
        { status: 404 }
      );
    }

    if (user.role !== 'admin' && existingProject.ownerId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: You do not own this project' },
        { status: 403 }
      );
    }

    const updateResult = await withDbRetry(() =>
      prisma.project.updateMany({
        where: user.role === 'admin' ? { id } : { id, ownerId: user.id },
        data: {
          name: validatedProject.name,
          type: validatedProject.type,
          contentJson: JSON.stringify(validatedProject),
        },
      })
    );


    if (updateResult.count === 0) {
      const exists = await prisma.project.findUnique({
        where: { id },
        select: { id: true },
      });

      return NextResponse.json(
        exists
          ? { error: 'Forbidden: You do not own this project' }
          : { error: `Project with ID ${id} not found` },
        { status: exists ? 403 : 404 }
      );
    }

    return NextResponse.json({ success: true, project: validatedProject });
  } catch (error) {
    console.error('Error updating project:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
