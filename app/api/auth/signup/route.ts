import { signUp } from '@/backend/auth';
import { readBody, respond, startSession, str } from '../../_lib/http';

export async function POST(req: Request) {
  const body = await readBody(req);
  const result = await signUp({ name: str(body.name), email: str(body.email), password: str(body.password), role: str(body.role) });
  if (result.ok) await startSession(result.data);
  return respond(result, 201);
}
