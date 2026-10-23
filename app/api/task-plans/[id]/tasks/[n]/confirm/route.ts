import { confirmTask } from '@/backend/documents';
import { respond, withUser, type Params } from '../../../../../_lib/http';

export const POST = withUser(async (user, _req, { params }: Params<'id' | 'n'>) => {
  const { id, n } = await params;
  return respond(await confirmTask(user, id, Number(n)));
});
