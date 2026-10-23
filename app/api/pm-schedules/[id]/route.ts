import { getDocument } from '@/backend/documents';
import { respond, withUser, type Params } from '../../_lib/http';

export const GET = withUser(async (_user, _req, { params }: Params<'id'>) =>
  respond(await getDocument('pm', (await params).id)),
);
