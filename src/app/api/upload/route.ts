import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { fileTypeFromBuffer } from 'file-type';
import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const contentLengthHeader = request.headers.get('content-length');
    if (contentLengthHeader) {
      const contentLength = parseInt(contentLengthHeader, 10);
      if (contentLength > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: 'File size exceeds the 10MB limit' },
          { status: 400 }
        );
      }
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File size exceeds the 10MB limit' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Magic-bytes MIME type check
    const detected = await fileTypeFromBuffer(buffer);
    if (!detected || !detected.mime.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Invalid file type. Only images are allowed.' },
        { status: 400 }
      );
    }

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(detected.mime)) {
      return NextResponse.json(
        { error: `Mime type ${detected.mime} is not supported. Only JPEG, PNG, and WebP are allowed.` },
        { status: 400 }
      );
    }

    const ext = (detected.ext === 'jpg' || detected.ext === 'jpeg') ? 'jpg' : detected.ext === 'png' ? 'png' : 'webp';

    // Process image via sharp to strip all metadata and optimize it
    const sharpInstance = sharp(buffer);
    
    // sharp strips EXIF by default unless withMetadata() is called.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const processedBuffer = await sharpInstance.toFormat(ext as any).toBuffer();
    const metadata = await sharp(processedBuffer).metadata();

    const uuid = crypto.randomUUID();
    const fileName = `${uuid}.${ext}`;
    const relativeUrl = `/uploads/${fileName}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    const filePath = path.join(uploadDir, fileName);

    // Ensure uploads directory exists
    await fs.mkdir(uploadDir, { recursive: true });

    // Save optimized file to disk
    await fs.writeFile(filePath, processedBuffer);

    // Insert database Asset entry using Prisma
    const asset = await prisma.asset.create({
      data: {
        id: uuid,
        name: file.name,
        type: 'image',
        filePath: relativeUrl,
        mime: detected.mime,
        mimeType: detected.mime,
        size: processedBuffer.length,
        sizeBytes: processedBuffer.length,
        width: metadata.width ?? null,
        height: metadata.height ?? null,
        focalPointX: 0.5,
        focalPointY: 0.5,
      },
    });

    return NextResponse.json(asset);
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
