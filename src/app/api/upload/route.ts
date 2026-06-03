import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { uploadToStorage } from '@/lib/utils/storage';
import { uploadRateLimiter } from '@/lib/utils/rateLimiter';

export async function POST(request: NextRequest) {
  // 1. Authenticate request using x-user-id header
  const userId = request.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json(
      { error: 'Unauthorized: Missing x-user-id header' },
      { status: 401 }
    );
  }

  // 2. Enforce token-bucket based rate limiting
  if (!uploadRateLimiter.consume(userId)) {
    return NextResponse.json(
      { error: 'Too Many Requests' },
      { status: 429 }
    );
  }

  const succeededAssets: { id: string; filePath: string; isRemote: boolean }[] = [];
  try {
    const isBulk = request.nextUrl.searchParams.get('bulk') === 'true';

    const contentLengthHeader = request.headers.get('content-length');
    if (contentLengthHeader) {
      const contentLength = parseInt(contentLengthHeader, 10);
      const limit = isBulk ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
      if (contentLength > limit) {
        return NextResponse.json(
          { error: `File size exceeds the ${limit / (1024 * 1024)}MB limit` },
          { status: 400 }
        );
      }
    }

    const formData = await request.formData();
    const files = (formData.getAll('file') as File[]).filter(
      (file) => file && typeof file.name === 'string'
    );

    if (files.length === 0) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate size of each file
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: `File ${file.name} exceeds the 10MB limit` },
          { status: 400 }
        );
      }
    }

    const processFile = async (file: File) => {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Magic-bytes MIME type check
      const detected = await fileTypeFromBuffer(buffer);
      if (!detected || !detected.mime.startsWith('image/')) {
        throw new Error('Invalid file type. Only images are allowed.');
      }

      const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedMimeTypes.includes(detected.mime)) {
        throw new Error(
          `Mime type ${detected.mime} is not supported for ${file.name}. Only JPEG, PNG, and WebP are allowed.`
        );
      }

      const ext = (detected.ext === 'jpg' || detected.ext === 'jpeg') ? 'jpg' : detected.ext === 'png' ? 'png' : 'webp';

      // Process image via sharp to strip all metadata and optimize it
      // Call rotate() to respect EXIF orientation before saving!
      const sharpInstance = sharp(buffer).rotate();

      // sharp strips EXIF by default unless withMetadata() is called.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const processedBuffer = await sharpInstance.toFormat(ext as any).toBuffer();
      const metadata = await sharp(processedBuffer).metadata();

      const uuid = crypto.randomUUID();
      const fileName = `${uuid}.${ext}`;

      // Upload using our new utility (supports S3/R2 with local fallback)
      const uploadResult = await uploadToStorage(processedBuffer, fileName, detected.mime);

      succeededAssets.push({ 
        id: uuid, 
        filePath: uploadResult.filePath, 
        isRemote: uploadResult.isRemote 
      });

      // Insert database Asset entry using Prisma (canonical fields only)
      const asset = await prisma.asset.create({
        data: {
          id: uuid,
          name: file.name,
          type: 'image',
          filePath: uploadResult.filePath,
          mimeType: detected.mime,
          sizeBytes: processedBuffer.length,
          width: metadata.width ?? null,
          height: metadata.height ?? null,
          focalPointX: 0.5,
          focalPointY: 0.5,
        },
      });

      return asset;
    };

    // Process all files concurrently
    const assets = await Promise.all(files.map(processFile));

    // For backwards-compatibility:
    // If not bulk mode and exactly one file was uploaded, return the single asset.
    // Otherwise (or in bulk mode), return the array of assets.
    if (!isBulk && files.length === 1) {
      return NextResponse.json(assets[0]);
    }

    return NextResponse.json(assets);
  } catch (error: unknown) {
    console.error('Error uploading file(s):', error);

    // Rollback any successfully created files/database entries to prevent orphans
    for (const asset of succeededAssets) {
      if (!asset.isRemote) {
        try {
          const localPath = path.join(process.cwd(), 'public', asset.filePath);
          await fs.unlink(localPath);
        } catch (err) {
          console.error(`Failed to cleanup file ${asset.filePath}:`, err);
        }
      }
      try {
        await prisma.asset.delete({ where: { id: asset.id } }).catch(() => {});
      } catch (err) {
        console.error(`Failed to cleanup database entry for asset ${asset.id}:`, err);
      }
    }

    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json(
      { error: errorMessage },
      { status: error instanceof Error ? 400 : 500 }
    );
  }
}

