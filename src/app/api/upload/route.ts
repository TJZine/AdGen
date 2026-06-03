import { NextRequest, NextResponse } from 'next/server';
import { prisma, withDbRetry } from '@/lib/db';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import crypto from 'crypto';
import { deleteFromStorage, uploadToStorage } from '@/lib/utils/storage';
import { uploadRateLimiter } from '@/lib/utils/rateLimiter';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth/server';

export async function POST(request: NextRequest) {
  const user = authenticateRequest(request);
  if (!user) {
    return unauthorizedResponse();
  }

  if (!uploadRateLimiter.consume(user.id)) {
    return NextResponse.json(
      { error: 'Too Many Requests' },
      { status: 429 }
    );
  }

  const succeededAssets: { id: string; filePath: string; isRemote: boolean; storageKey?: string }[] = [];
  try {
    const isBulk = request.nextUrl.searchParams.get('bulk') === 'true';

    const contentLengthHeader = request.headers.get('content-length');
    if (contentLengthHeader) {
      const contentLength = parseInt(contentLengthHeader, 10);
      if (Number.isNaN(contentLength) || contentLength < 0) {
        return NextResponse.json(
          { error: 'Invalid content-length header' },
          { status: 400 }
        );
      }
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
      const format = ext === 'jpg' ? 'jpeg' : ext;
      const processedBuffer = await sharpInstance.toFormat(format as keyof sharp.FormatEnum).toBuffer();
      const metadata = await sharp(processedBuffer).metadata();

      const uuid = crypto.randomUUID();
      const fileName = `${uuid}.${ext}`;

      // Upload using our new utility (supports S3/R2 with local fallback)
      const uploadResult = await uploadToStorage(processedBuffer, fileName, detected.mime);

      succeededAssets.push({ 
        id: uuid, 
        filePath: uploadResult.filePath, 
        isRemote: uploadResult.isRemote,
        storageKey: uploadResult.storageKey,
      });

      // Insert database Asset entry using Prisma (canonical fields only)
      const asset = await withDbRetry(() =>
        prisma.asset.create({
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
        })
      );

      return asset;

    };

    const settledAssets = await Promise.allSettled(files.map(processFile));
    const failedUpload = settledAssets.find((result) => result.status === 'rejected');

    if (failedUpload) {
      throw failedUpload.reason;
    }

    const assets = settledAssets.map((result) => {
      if (result.status !== 'fulfilled') {
        throw new Error('Unexpected upload result state');
      }
      return result.value;
    });

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
      try {
        await deleteFromStorage(asset.filePath, asset.isRemote, asset.storageKey);
      } catch (err) {
        console.error(`Failed to cleanup file ${asset.filePath}:`, err);
      }

      try {
        await withDbRetry(() => prisma.asset.delete({ where: { id: asset.id } })).catch(() => {});
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
