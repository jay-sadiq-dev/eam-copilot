import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { createUser, getUserByEmail } from '../data/users';
import type { Role } from '../data/types';
import { fail, ok, type Result } from './result';

// What the session carries. Roles are checked against this on every request.
export interface SessionUser {
  id: string;
  name: string;
  role: Role;
}

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error('AUTH_SECRET must be set to at least 32 characters');
  return new TextEncoder().encode(s);
}

export interface SignUpInput {
  name: string;
  email: string;
  password: string;
  role: string;
}

export async function signUp(input: SignUpInput): Promise<Result<SessionUser>> {
  const name = input.name.trim();
  if (!name) return fail(400, 'Enter your full name.');
  if (!EMAIL.test(input.email.trim())) return fail(400, 'Enter a valid email address.');
  if (input.password.length < 6) return fail(400, 'Use a password of at least 6 characters.');
  if (input.role !== 'consultant' && input.role !== 'admin') return fail(400, 'Choose a role.');

  const user = await createUser({
    name,
    email: input.email,
    passwordHash: await bcrypt.hash(input.password, 10),
    role: input.role,
  });
  if (!user) return fail(409, 'An account with this email already exists. Sign in instead.');
  return ok({ id: user.id, name: user.name, role: user.role });
}

export async function signIn(email: string, password: string): Promise<Result<SessionUser>> {
  if (!email.trim() || !password) return fail(400, 'Enter your email and password.');
  const user = await getUserByEmail(email);
  // Same message either way, so the form doesn't reveal which emails have accounts.
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return fail(401, 'Email or password is incorrect.');
  }
  return ok({ id: user.id, name: user.name, role: user.role });
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ name: user.name, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret());
}

// Returns null for a missing, expired or tampered token.
export async function readSessionToken(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const key = secret();
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
    const { sub, name, role } = payload;
    if (typeof sub !== 'string' || typeof name !== 'string' || (role !== 'consultant' && role !== 'admin')) return null;
    return { id: sub, name, role };
  } catch {
    return null;
  }
}
