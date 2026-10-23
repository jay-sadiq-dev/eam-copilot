import { sql, type Row } from './db';
import type { NewUser, User, UserWithPassword } from './types';

function toUser(r: Row): User {
  return { id: r.id, name: r.name, email: r.email, role: r.role, createdAt: r.created_at };
}

// Returns null when the email is already taken.
export async function createUser(input: NewUser): Promise<User | null> {
  const rows = await sql`
    INSERT INTO users (name, email, password_hash, role)
    VALUES (${input.name.trim()}, ${input.email.trim().toLowerCase()}, ${input.passwordHash}, ${input.role})
    ON CONFLICT (email) DO NOTHING
    RETURNING *`;
  return rows[0] ? toUser(rows[0]) : null;
}

export async function getUserById(id: string): Promise<User | null> {
  const rows = await sql`SELECT * FROM users WHERE id = ${id}`;
  return rows[0] ? toUser(rows[0]) : null;
}

// For sign in only: includes the password hash.
export async function getUserByEmail(email: string): Promise<UserWithPassword | null> {
  const rows = await sql`SELECT * FROM users WHERE email = ${email.trim().toLowerCase()}`;
  return rows[0] ? { ...toUser(rows[0]), passwordHash: rows[0].password_hash } : null;
}
