import { NextRequest, NextResponse } from 'next/server';
import { renderLayoutOverlayPng, renderLayoutOverlaySvg } from '@/lib/export/renderService';
import { authorizeProjectAccess, authenticateRequest } from '@/lib/auth/server';
import { exportRateLimiter } from '@/lib/utils/rateLimiter';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const format = searchParams.get('format');

  if (!id) {
    return NextResponse.json(
      { error: 'Missing required parameter: id' },
      { status: 400 }
    );
  }

  if (format !== 'png' && format !== 'svg') {
    return NextResponse.json(
      { error: "Invalid format parameter. Must be 'png' or 'svg'" },
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
    if (format === 'png') {
      const pngBuffer = await renderLayoutOverlayPng(id);
      return new NextResponse(new Uint8Array(pngBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Content-Length': pngBuffer.length.toString(),
          'Cache-Control': 'no-store, must-revalidate',
        },
      });
    } else {
      const svgString = await renderLayoutOverlaySvg(id);
      return new NextResponse(svgString, {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'no-store, must-revalidate',
        },
      });
    }
  } catch (error) {
    console.error('Error rendering overlay:', error);
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
