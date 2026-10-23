import { endSession } from '../../_lib/http';

export async function POST() {
  await endSession();
  return new Response(null, { status: 204 });
}
