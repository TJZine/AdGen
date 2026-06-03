import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export type AuthenticatedRole = 'admin' | 'user';

export interface AuthenticatedUser {
  id: string;
  role: AuthenticatedRole;
}

const SESSION_COOKIE_NAME = 'adgen_session';
const MAX_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

function isValidRole(role: unknown): role is AuthenticatedRole {
  return role === 'admin' || role === 'user';
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifySignedSession(token: string, secret: string): AuthenticatedUser | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payload, signature] = parts;
  if (!payload || !signature) return null;

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');

  if (!safeEqual(signature, expectedSignature)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      userId?: unknown;
      role?: unknown;
      exp?: unknown;
    };

    if (typeof parsed.userId !== 'string' || parsed.userId.length === 0) return null;
    if (!isValidRole(parsed.role)) return null;

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (typeof parsed.exp !== 'number') return null;
    if (parsed.exp <= nowSeconds) return null;
    if (parsed.exp - nowSeconds > MAX_SESSION_TTL_SECONDS) return null;

    return {
      id: parsed.userId,
      role: parsed.role,
    };
  } catch {
    return null;
  }
}

function getDevelopmentUser(request: NextRequest): AuthenticatedUser | null {
  if (process.env.NODE_ENV === 'production') return null;

  const id = request.headers.get('x-user-id') || process.env.ADGEN_DEV_USER_ID || 'dev_user';
  const requestedRole = request.headers.get('x-user-role') || process.env.ADGEN_DEV_USER_ROLE || 'admin';
  const role = isValidRole(requestedRole) ? requestedRole : 'user';

  return { id, role };
}

function getDevelopmentServerUser(): AuthenticatedUser | null {
  if (process.env.NODE_ENV === 'production') return null;

  const requestedRole = process.env.ADGEN_DEV_USER_ROLE || 'admin';
  return {
    id: process.env.ADGEN_DEV_USER_ID || 'dev_user',
    role: isValidRole(requestedRole) ? requestedRole : 'user',
  };
}

export function authenticateRequest(request: NextRequest): AuthenticatedUser | null {
  const secret = process.env.ADGEN_AUTH_SECRET;
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (secret && sessionToken) {
    const user = verifySignedSession(sessionToken, secret);
    if (user) return user;
  }

  if (secret) return null;

  return getDevelopmentUser(request);
}

export function authenticateSessionCookie(sessionToken?: string): AuthenticatedUser | null {
  const secret = process.env.ADGEN_AUTH_SECRET;

  if (secret && sessionToken) {
    const user = verifySignedSession(sessionToken, secret);
    if (user) return user;
  }

  if (secret) return null;

  return getDevelopmentServerUser();
}

export { SESSION_COOKIE_NAME };

export function unauthorizedResponse(message = 'Unauthorized') {
  return NextResponse.json({ error: message }, { status: 401 });
}
