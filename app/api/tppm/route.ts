import { checkPair, listLinks } from '@/backend/tppm';
import { readBody, respond, str, withUser } from '../_lib/http';

export const GET = withUser(async () => respond(await listLinks()));

// Run the checks on a pair. Body: { "taskPlanId": "TP-0001", "pmScheduleId": "PM-0001" }
export const POST = withUser(async (user, req) => {
  const body = await readBody(req);
  return respond(await checkPair(user, str(body.taskPlanId), str(body.pmScheduleId)), 201);
});
