import { create } from 'zustand';

interface SessionState {
  sessionId: string;
}

export const useSessionStore = create<SessionState>()(() => ({
  sessionId: crypto.randomUUID(),
}));
