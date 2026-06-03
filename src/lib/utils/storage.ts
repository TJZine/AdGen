import { promises as fs } from 'fs';
import path from 'path';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

interface StorageConfig {
  bucket: string;
  endpoint?: string;
  region: string;
  forcePathStyle: boolean;
}

function getStorageConfig(): StorageConfig | null {
  const bucket = process.env.AWS_S3_BUCKET;
  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
  const endpoint = process.env.AWS_S3_ENDPOINT;
  const publicBaseUrl = process.env.AWS_S3_PUBLIC_BASE_URL;
  const region = process.env.AWS_REGION;

  if (!bucket && !accessKey && !secretKey) return null;
  if (!bucket || !accessKey || !secretKey) {
    throw new Error('Remote storage is partially configured. AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY are required together.');
  }

  if (!endpoint && !publicBaseUrl && !region) {
    throw new Error('AWS_REGION is required when AWS_S3_ENDPOINT or AWS_S3_PUBLIC_BASE_URL is not configured.');
  }

  return {
    bucket,
    endpoint,
    region: region || 'auto',
    forcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE === 'true',
  };
}

function createS3Client(config: StorageConfig): S3Client {
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

function remoteFileUrl(config: StorageConfig, key: string): string {
  if (process.env.AWS_S3_PUBLIC_BASE_URL) {
    return `${process.env.AWS_S3_PUBLIC_BASE_URL.replace(/\/$/, '')}/${key}`;
  }

  if (config.endpoint) {
    const endpoint = new URL(config.endpoint);
    if (config.forcePathStyle) return `${endpoint.origin}/${config.bucket}/${key}`;
    return `${endpoint.protocol}//${config.bucket}.${endpoint.host}/${key}`;
  }

  return `https://${config.bucket}.s3.${config.region}.amazonaws.com/${key}`;
}

/**
 * Uploads a file buffer to storage.
 * If S3/R2 credentials are fully configured, uploads through a signed SDK request.
 * Otherwise, writes locally under public/uploads.
 */
export async function uploadToStorage(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<{ filePath: string; isRemote: boolean; storageKey?: string }> {
  const remoteConfig = getStorageConfig();

  if (remoteConfig) {
    const client = createS3Client(remoteConfig);
    await client.send(new PutObjectCommand({
      Bucket: remoteConfig.bucket,
      Key: fileName,
      Body: buffer,
      ContentType: mimeType,
    }));

    return { filePath: remoteFileUrl(remoteConfig, fileName), isRemote: true, storageKey: fileName };
  }

  // Fallback to local storage
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  const localFilePath = path.join(uploadDir, fileName);

  // Ensure uploads directory exists
  await fs.mkdir(uploadDir, { recursive: true });
  // Save file to disk
  await fs.writeFile(localFilePath, buffer);

  return {
    filePath: `/uploads/${fileName}`,
    isRemote: false,
  };
}

export async function deleteFromStorage(filePath: string, isRemote: boolean, storageKey?: string): Promise<void> {
  if (isRemote) {
    const remoteConfig = getStorageConfig();
    if (!remoteConfig) {
      throw new Error(`Cannot delete remote file without remote storage configuration: ${filePath}`);
    }

    const key = storageKey || decodeURIComponent(new URL(filePath).pathname.split('/').filter(Boolean).pop() || '');
    if (!key) throw new Error(`Cannot determine remote storage key for ${filePath}`);

    const client = createS3Client(remoteConfig);
    await client.send(new DeleteObjectCommand({
      Bucket: remoteConfig.bucket,
      Key: key,
    }));
    return;
  }

  const localPath = path.join(process.cwd(), 'public', filePath);
  await fs.unlink(localPath);
}
