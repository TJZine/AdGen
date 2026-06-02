import { NextRequest, NextResponse } from 'next/server';
import { createHandoffPackage } from '@/lib/export/zipPackager';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json(
      { error: 'Missing required parameter: id' },
      { status: 400 }
    );
  }

  try {
    const zipBuffer = await createHandoffPackage(id);

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="handoff-${id}.zip"`,
        'Content-Length': zipBuffer.length.toString(),
        'Cache-Control': 'no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error creating handoff package ZIP:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Internal Server Error';

    if (errorMessage.toLowerCase().includes('not found')) {
      return NextResponse.json(
        { error: errorMessage },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
