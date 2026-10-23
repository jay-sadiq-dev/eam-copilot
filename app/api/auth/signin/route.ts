import { signIn } from '@/backend/auth';
import { readBody, respond, startSession, str } from '../../_lib/http';

export async function POST(req: Request) {
  const body = await readBody(req);
  const result = await signIn(str(body.email), str(body.password));
  if (result.ok) await startSession(result.data);
  return respond(result);
}
