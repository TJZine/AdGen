import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { authenticateRequest } from '@/lib/auth/server';

function signedSession(payload: object, secret: string): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${signature}`;
}

describe('server auth helper', () => {
  it('accepts a valid signed session cookie', () => {
    vi.stubEnv('ADGEN_AUTH_SECRET', 'test-secret');
    const token = signedSession({
      userId: 'user_123',
      role: 'user',
      exp: Math.floor(Date.now() / 1000) + 60,
    }, 'test-secret');
    const request = new NextRequest('http://localhost/api/upload', {
      headers: {
        cookie: `adgen_session=${token}`,
      },
    });

    expect(authenticateRequest(request)).toEqual({ id: 'user_123', role: 'user' });
    vi.unstubAllEnvs();
  });

  it('rejects signed sessions without a valid expiry', () => {
    vi.stubEnv('ADGEN_AUTH_SECRET', 'test-secret');
    const token = signedSession({ userId: 'user_123', role: 'user' }, 'test-secret');
    const request = new NextRequest('http://localhost/api/upload', {
      headers: {
        cookie: `adgen_session=${token}`,
      },
    });

    expect(authenticateRequest(request)).toBeNull();
    vi.unstubAllEnvs();
  });

  it('rejects expired signed sessions', () => {
    vi.stubEnv('ADGEN_AUTH_SECRET', 'test-secret');
    const token = signedSession({
      userId: 'user_123',
      role: 'user',
      exp: Math.floor(Date.now() / 1000) - 1,
    }, 'test-secret');
    const request = new NextRequest('http://localhost/api/upload', {
      headers: {
        cookie: `adgen_session=${token}`,
      },
    });

    expect(authenticateRequest(request)).toBeNull();
    vi.unstubAllEnvs();
  });

  it('rejects signed sessions with extra token segments', () => {
    vi.stubEnv('ADGEN_AUTH_SECRET', 'test-secret');
    const token = `${signedSession({
      userId: 'user_123',
      role: 'user',
      exp: Math.floor(Date.now() / 1000) + 60,
    }, 'test-secret')}.extra`;
    const request = new NextRequest('http://localhost/api/upload', {
      headers: {
        cookie: `adgen_session=${token}`,
      },
    });

    expect(authenticateRequest(request)).toBeNull();
    vi.unstubAllEnvs();
  });

  it('rejects forged headers when signed auth is configured', () => {
    vi.stubEnv('ADGEN_AUTH_SECRET', 'test-secret');
    const request = new NextRequest('http://localhost/api/upload', {
      headers: {
        'x-user-id': 'attacker',
        'x-user-role': 'admin',
      },
    });

    expect(authenticateRequest(request)).toBeNull();
    vi.unstubAllEnvs();
  });
});
