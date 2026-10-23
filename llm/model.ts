import { google } from '@ai-sdk/google';

// Override with GEMINI_MODEL to pin a specific version; the default alias tracks Google's current Flash model.
const MODEL_ID = process.env.GEMINI_MODEL || 'gemini-flash-latest';

export const isCopilotConfigured = () => Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);

export const copilotModel = () => google(MODEL_ID);
