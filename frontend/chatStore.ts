'use client';

import { Chat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';

// One chat per signed-in user, kept in memory so the conversation (and an unsaved draft)
// survives moving between pages. A full page refresh starts fresh; chats aren't stored.
const chats = new Map<string, Chat<UIMessage>>();

export function chatFor(userId: string): Chat<UIMessage> {
  let chat = chats.get(userId);
  if (!chat) {
    chat = new Chat<UIMessage>({ transport: new DefaultChatTransport({ api: '/api/chat' }) });
    chats.set(userId, chat);
  }
  return chat;
}
