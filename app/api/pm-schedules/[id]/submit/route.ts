import { submitForApproval } from '@/backend/documents';
import { respond, withUser, type Params } from '../../../_lib/http';

export const POST = withUser(async (user, _req, { params }: Params<'id'>) =>
  respond(await submitForApproval(user, 'pm', (await params).id)),
);
