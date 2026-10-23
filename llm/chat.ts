import { convertToModelMessages, isStepCount, streamText, toUIMessageStream, type UIMessage } from 'ai';
import type { SessionUser } from '../backend/auth';
import { instructionsFor } from './instructions';
import { copilotModel, copilotProviderOptions } from './model';
import { toolsFor } from './tools';

// Most turns need 1-3 steps (e.g. list, then act, then answer); this caps runaway loops.
const MAX_STEPS = 8;

// Stop a turn before Vercel's 60 s function limit so the user gets a message, not a dropped connection.
const TURN_TIMEOUT_MS = 55_000;

// Turns provider failures into a message the user can act on, without leaking internals.
// The SDK retries first; after that the error may be wrapped, so look at lastError too.
function errorMessage(error: unknown): string {
  const e = error as { name?: string; statusCode?: number; lastError?: { statusCode?: number } };
  if (e?.name === 'TimeoutError' || e?.name === 'AbortError') {
    return 'Copilot took too long to answer. Please try again, or ask for less at once.';
  }
  const status = e?.statusCode ?? e?.lastError?.statusCode;
  if (status === 503) return 'Gemini is busy right now. Please try again in a minute.';
  if (status === 429) return 'Copilot has hit its usage limit for now. Please try again later.';
  if (status === 401 || status === 403) return 'Copilot could not sign in to Gemini. Check the API key.';
  if (status === 413) return 'That file is too large. Try a smaller PDF.';
  if (status === 404) return 'The Gemini model is not available to this API key. Check GEMINI_MODEL.';
  return 'Copilot ran into a problem. Please try again.';
}

// Gemini doesn't receive attachment file names, so add each one as text next to the file.
// The draft's sourceFilename comes from this.
function withFileNames(messages: UIMessage[]): UIMessage[] {
  return messages.map((m) =>
    m.role !== 'user'
      ? m
      : {
          ...m,
          parts: m.parts.flatMap((p) =>
            p.type === 'file' && p.filename ? [p, { type: 'text' as const, text: `(Attached file: ${p.filename})` }] : [p],
          ),
        },
  );
}

// Runs one chat turn for the user and returns a UI message stream for useChat.
// Attached PDFs arrive as file parts in the messages and are read by Gemini directly.
export async function runCopilot(user: SessionUser, messages: UIMessage[]) {
  const result = streamText({
    model: copilotModel(),
    instructions: instructionsFor(user),
    messages: await convertToModelMessages(withFileNames(messages)),
    tools: toolsFor(user),
    stopWhen: isStepCount(MAX_STEPS),
    providerOptions: copilotProviderOptions,
    abortSignal: AbortSignal.timeout(TURN_TIMEOUT_MS),
  });
  return toUIMessageStream({ stream: result.stream, onError: errorMessage });
}
