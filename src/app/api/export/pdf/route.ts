import { NextRequest, NextResponse } from 'next/server';
import { renderLayoutPdf } from '@/lib/export/renderService';
import { authorizeProjectAccess, authenticateRequest } from '@/lib/auth/server';
import { exportRateLimiter } from '@/lib/utils/rateLimiter';

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

  // 1. Rate Limiting Check
  const user = authenticateRequest(request);
  const rateLimitKey = user ? user.id : (request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'anonymous');
  if (!exportRateLimiter.consume(rateLimitKey)) {
    return NextResponse.json(
      { error: 'Too Many Requests' },
      { status: 429 }
    );
  }

  // 2. Authorization Check
  const authResult = await authorizeProjectAccess(id, request);
  if (!authResult.authorized) {
    return authResult.response;
  }

  try {
    const pdfBuffer = await renderLayoutPdf(id);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': pdfBuffer.length.toString(),
        'Content-Disposition': `attachment; filename="flyer-${id}.pdf"`,
        'Cache-Control': 'no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error rendering PDF:', error);
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
