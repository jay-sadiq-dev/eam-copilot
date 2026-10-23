import { listDocuments } from '@/backend/documents';
import { respond, statusParam, withUser } from '../_lib/http';

// GET /api/task-plans?status=submitted
export const GET = withUser(async (_user, req) => respond(await listDocuments('tp', statusParam(req))));
