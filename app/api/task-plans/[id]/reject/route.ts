import { reject } from '@/backend/documents';
import { readBody, respond, str, withUser, type Params } from '../../../_lib/http';

// Body: { "reason": "Torque values missing" }
export const POST = withUser(async (user, req, { params }: Params<'id'>) =>
  respond(await reject(user, 'tp', (await params).id, str((await readBody(req)).reason))),
);
