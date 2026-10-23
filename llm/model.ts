import { google } from '@ai-sdk/google';

// Set GEMINI_MODEL to use a different Gemini model.
const MODEL_ID = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

export const isCopilotConfigured = () => Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);

export const copilotModel = () => google(MODEL_ID);
