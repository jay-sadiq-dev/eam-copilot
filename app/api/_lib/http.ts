// HTTP glue shared by the API routes: session cookie, JSON in/out, Result -> Response.
// Routes stay thin: read the request, call backend/, return what it says.

import { cookies } from 'next/headers';
import { SESSION_TTL_SECONDS, createSessionToken, readSessionToken, type SessionUser } from '@/backend/auth';
import type { Result } from '@/backend/result';
import type { DocStatus } from '@/data/types';

const SESSION_COOKIE = 'eam_session';

export type Params<K extends string> = { params: Promise<Record<K, string>> };

export async function currentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  return readSessionToken(store.get(SESSION_COOKIE)?.value);
}

export async function startSession(user: SessionUser) {
  const store = await cookies();
  store.set(SESSION_COOKIE, await createSessionToken(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export function respond<T>(result: Result<T>, okStatus = 200): Response {
  return result.ok
    ? Response.json(result.data, { status: okStatus })
    : Response.json({ error: result.error }, { status: result.status });
}

// Wraps a route handler that needs a signed-in user; returns 401 otherwise.
export function withUser<C>(handler: (user: SessionUser, req: Request, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C): Promise<Response> => {
    const user = await currentUser();
    if (!user) return Response.json({ error: 'Sign in first.' }, { status: 401 });
    return handler(user, req, ctx);
  };
}

// Request body as an object; anything that isn't a JSON object becomes {}.
export async function readBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  } catch {
    return {};
  }
}

export const str = (v: unknown) => (typeof v === 'string' ? v : '');

const STATUSES: DocStatus[] = ['draft', 'submitted', 'approved', 'rejected'];

// ?status=submitted -> 'submitted'; missing or unknown -> undefined (no filter).
export function statusParam(req: Request): DocStatus | undefined {
  const s = new URL(req.url).searchParams.get('status');
  return STATUSES.find((x) => x === s);
}
