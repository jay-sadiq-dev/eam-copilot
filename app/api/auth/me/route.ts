import { withUser } from '../../_lib/http';

// The signed-in user, or 401.
export const GET = withUser(async (user) => Response.json(user));
