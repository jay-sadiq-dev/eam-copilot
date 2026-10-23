import { reject } from '@/backend/documents';
import { readBody, respond, str, withUser, type Params } from '../../../_lib/http';

// Body: { "reason": "Intervals don't match the manual" }
export const POST = withUser(async (user, req, { params }: Params<'id'>) =>
  respond(await reject(user, 'pm', (await params).id, str((await readBody(req)).reason))),
);
