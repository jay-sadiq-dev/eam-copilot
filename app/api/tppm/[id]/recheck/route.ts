import { recheckLink } from '@/backend/tppm';
import { respond, withUser, type Params } from '../../../_lib/http';

export const POST = withUser(async (user, _req, { params }: Params<'id'>) =>
  respond(await recheckLink(user, (await params).id)),
);
