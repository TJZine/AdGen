import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ProjectSchema } from '@/lib/schemas/project';

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

    const body = await request.json();

    const parseResult = ProjectSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid project data', details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const validatedProject = parseResult.data;

    // Check if the project exists in the database
    const existing = await prisma.project.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: `Project with ID ${id} not found` },
        { status: 404 }
      );
    }

    // Update name, type, and contentJson in database
    await prisma.project.update({
      where: { id },
      data: {
        name: validatedProject.name,
        type: validatedProject.type,
        contentJson: JSON.stringify(validatedProject),
      },
    });

    return NextResponse.json({ success: true, project: validatedProject });
  } catch (error) {
    console.error('Error updating project:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
