import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ProjectSchema } from '@/lib/schemas/project';
import { Prisma } from '@prisma/client';
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

    try {
      await prisma.project.update({
        where: { id },
        data: {
          name: validatedProject.name,
          type: validatedProject.type,
          contentJson: JSON.stringify(validatedProject),
        },
      });

      return NextResponse.json({ success: true, project: validatedProject });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        // Differentiate 403 Forbidden from 404 Not Found by checking if project exists at all
        const exists = await prisma.project.findUnique({
          where: { id },
          select: { id: true }
        });
        if (exists) {
          return NextResponse.json(
            { error: 'Forbidden: You do not own this project' },
            { status: 403 }
          );
        }
        return NextResponse.json(
          { error: `Project with ID ${id} not found` },
          { status: 404 }
        );
      }
      throw err;
    }
  } catch (error) {
    console.error('Error updating project:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
