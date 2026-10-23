import { discardLink, getLink } from '@/backend/tppm';
import { respond, withUser, type Params } from '../../_lib/http';

export const GET = withUser(async (_user, _req, { params }: Params<'id'>) => respond(await getLink((await params).id)));

// Discard a proposed association.
export const DELETE = withUser(async (user, _req, { params }: Params<'id'>) =>
  respond(await discardLink(user, (await params).id)),
);
