import { describe, expect, it, vi } from 'vitest';
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
  it('fails closed when AWS S3 lacks a region, endpoint, or public URL', async () => {
    vi.stubEnv('AWS_S3_BUCKET', 'bucket');
    vi.stubEnv('AWS_ACCESS_KEY_ID', 'access');
    vi.stubEnv('AWS_SECRET_ACCESS_KEY', 'secret');
    vi.stubEnv('AWS_REGION', '');
    vi.stubEnv('AWS_S3_ENDPOINT', '');
    vi.stubEnv('AWS_S3_PUBLIC_BASE_URL', '');

    await expect(uploadToStorage(Buffer.from('data'), 'file.png', 'image/png')).rejects.toThrow('AWS_REGION is required');

    vi.unstubAllEnvs();
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

    vi.unstubAllEnvs();
    sendMock.mockReset();
  });
});
