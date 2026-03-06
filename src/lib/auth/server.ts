import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/auth/supabase';

export type AuthUser = {
  id: string;
  email?: string;
  name?: string;
};

/**
 * Extract bearer token from Authorization header.
 */
export function getBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!authHeader) return null;
  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

/**
 * Require a valid Supabase Auth user (server-side).
 * Throws on missing/invalid auth.
 */
export class AuthError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'AuthError';
  }
}

export async function requireUser(req: NextRequest): Promise<AuthUser> {
  const token = getBearerToken(req);
  if (!token) {
    throw new AuthError('Unauthorized');
  }

  const serverClient = createServerClient();
  const { data, error } = await serverClient.auth.getUser(token);
  if (error || !data.user) {
    throw new AuthError('Unauthorized');
  }

  return {
    id: data.user.id,
    email: data.user.email ?? undefined,
    name: (data.user.user_metadata as any)?.name ?? undefined,
  };
}
