import { createUIMessageStreamResponse, type UIMessage } from 'ai';
import { runCopilot } from '@/llm/chat';
import { isCopilotConfigured } from '@/llm/model';
import { readBody, withUser } from '../_lib/http';

// Reading a manual and calling tools can take a while.
export const maxDuration = 60;

// Body: { messages: UIMessage[] } (what useChat sends).
export const POST = withUser(async (user, req) => {
  if (!isCopilotConfigured()) return Response.json({ error: 'Copilot is not configured yet.' }, { status: 503 });
  const { messages } = await readBody(req);
  if (!Array.isArray(messages) || !messages.length) return Response.json({ error: 'Send at least one message.' }, { status: 400 });
  return createUIMessageStreamResponse({ stream: await runCopilot(user, messages as UIMessage[]) });
});
