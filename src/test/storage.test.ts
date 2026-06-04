import { afterEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { uploadToStorage } from '@/lib/utils/storage';

const sendMock = vi.hoisted(() => vi.fn());

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn(function S3Client() {
    return { send: sendMock };
  }),
  PutObjectCommand: vi.fn(function PutObjectCommand(input) {
    return { kind: 'PutObjectCommand', input };
  }),
  DeleteObjectCommand: vi.fn(function DeleteObjectCommand(input) {
    return { kind: 'DeleteObjectCommand', input };
  }),
}));

describe('storage utility', () => {
  const regionOnlyFallbackFile = 'region-only-fallback.png';

  afterEach(async () => {
    vi.unstubAllEnvs();
    sendMock.mockReset();
    await fs.rm(path.join(process.cwd(), 'public', 'uploads', regionOnlyFallbackFile), { force: true });
  });

  it('fails closed when AWS S3 lacks a region, endpoint, or public URL', async () => {
    vi.stubEnv('AWS_S3_BUCKET', 'bucket');
    vi.stubEnv('AWS_ACCESS_KEY_ID', 'access');
    vi.stubEnv('AWS_SECRET_ACCESS_KEY', 'secret');
    vi.stubEnv('AWS_REGION', '');
    vi.stubEnv('AWS_S3_ENDPOINT', '');
    vi.stubEnv('AWS_S3_PUBLIC_BASE_URL', '');

    await expect(uploadToStorage(Buffer.from('data'), 'file.png', 'image/png')).rejects.toThrow('AWS_REGION is required');
  });

  it('fails closed when endpoint configuration is present without required credentials', async () => {
    vi.stubEnv('AWS_S3_BUCKET', '');
    vi.stubEnv('AWS_ACCESS_KEY_ID', '');
    vi.stubEnv('AWS_SECRET_ACCESS_KEY', '');
    vi.stubEnv('AWS_S3_ENDPOINT', 'https://storage.example.com');

    await expect(uploadToStorage(Buffer.from('data'), 'file.png', 'image/png')).rejects.toThrow(
      'AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY are required together'
    );
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('fails closed when public URL configuration is present without required credentials', async () => {
    vi.stubEnv('AWS_S3_BUCKET', '');
    vi.stubEnv('AWS_ACCESS_KEY_ID', '');
    vi.stubEnv('AWS_SECRET_ACCESS_KEY', '');
    vi.stubEnv('AWS_S3_PUBLIC_BASE_URL', 'https://cdn.example.com/assets');

    await expect(uploadToStorage(Buffer.from('data'), 'file.png', 'image/png')).rejects.toThrow(
      'AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY are required together'
    );
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('allows local storage fallback when only generic AWS region configuration is present', async () => {
    vi.stubEnv('AWS_S3_BUCKET', '');
    vi.stubEnv('AWS_ACCESS_KEY_ID', '');
    vi.stubEnv('AWS_SECRET_ACCESS_KEY', '');
    vi.stubEnv('AWS_REGION', 'us-east-1');

    const result = await uploadToStorage(Buffer.from('data'), regionOnlyFallbackFile, 'image/png');

    expect(result).toEqual({
      filePath: `/uploads/${regionOnlyFallbackFile}`,
      isRemote: false,
    });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('uses signed S3 client uploads and returns configured public URLs', async () => {
    sendMock.mockResolvedValueOnce({});
    vi.stubEnv('AWS_S3_BUCKET', 'bucket');
    vi.stubEnv('AWS_ACCESS_KEY_ID', 'access');
    vi.stubEnv('AWS_SECRET_ACCESS_KEY', 'secret');
    vi.stubEnv('AWS_REGION', 'us-east-1');
    vi.stubEnv('AWS_S3_PUBLIC_BASE_URL', 'https://cdn.example.com/assets');

    const result = await uploadToStorage(Buffer.from('data'), 'file.png', 'image/png');

    expect(result).toEqual({
      filePath: 'https://cdn.example.com/assets/file.png',
      isRemote: true,
      storageKey: 'file.png',
    });
    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'PutObjectCommand',
    }));
  });
});
