import { google } from '@ai-sdk/google';

// Set GEMINI_MODEL to use a different Gemini model. The newest Flash models were often
// overloaded (503) in testing; 3.5 Flash answered a full Copilot turn in about 5 seconds.
const MODEL_ID = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

export const isCopilotConfigured = () => Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);

export const copilotModel = () => google(MODEL_ID);

// Gemini models "think" before answering; low keeps turns fast enough for the 60 s request limit.
export const copilotProviderOptions = { google: { thinkingConfig: { thinkingLevel: 'low' as const } } };
