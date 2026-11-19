import { create } from 'zustand';

import { engagementApi } from '@/features/engagement/api';

/** Contador de notificações não lidas (badge do sino no Feed) — US-21 */
type NotificationsState = {
  unread: number;
  refresh: () => Promise<void>;
  setUnread: (n: number) => void;
  increment: () => void;
};

export const useNotifications = create<NotificationsState>((set) => ({
  unread: 0,
  refresh: async () => {
    try {
      set({ unread: await engagementApi.unreadCount() });
    } catch {
      // sem internet: mantém o último valor
    }
  },
  setUnread: (unread) => set({ unread }),
  increment: () => set((s) => ({ unread: s.unread + 1 })),
}));
