import { listDocuments } from '@/backend/documents';
import { respond, statusParam, withUser } from '../_lib/http';

// GET /api/pm-schedules?status=submitted
export const GET = withUser(async (_user, req) => respond(await listDocuments('pm', statusParam(req))));
