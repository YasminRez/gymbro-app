import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { newClientId } from '@/domain/chat';
import { PublishDraft, PublishResult, Visibility } from '@/domain/feed';

/**
 * Rascunho da publicação (US-15, cenário 5): fica salvo no celular, então uma falha
 * no envio — ou fechar o app — não perde a foto e a legenda.
 * lastResult alimenta a tela "Dia concluído" (F5).
 */
const emptyDraft = (visibilidade: Visibility = 'academia_conexoes'): PublishDraft => ({
  fotoUri: null,
  legenda: '',
  modalidade: null,
  duracaoMin: null,
  visibilidade,
  clientId: newClientId(),
});

type PublishState = {
  draft: PublishDraft;
  lastResult: PublishResult | null;
  /** Avisa o feed que precisa recarregar (nova publicação ou exclusão) */
  feedVersion: number;
  /** Comentários adicionados/removidos fora do feed (tela F2), por publicação */
  commentCounts: Record<string, number>;
  setCommentCount: (id: string, n: number) => void;
  update: (patch: Partial<PublishDraft>) => void;
  reset: () => void;
  setResult: (r: PublishResult | null) => void;
  bumpFeed: () => void;
};

export const usePublish = create<PublishState>()(
  persist(
    (set) => ({
      draft: emptyDraft(),
      lastResult: null,
      feedVersion: 0,
      commentCounts: {},
      setCommentCount: (id, n) => set((s) => ({ commentCounts: { ...s.commentCounts, [id]: n } })),
      update: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
      reset: () => set((s) => ({ draft: emptyDraft(s.draft.visibilidade) })),
      setResult: (lastResult) => set({ lastResult }),
      bumpFeed: () => set((s) => ({ feedVersion: s.feedVersion + 1 })),
    }),
    {
      name: '@gymbro:rascunho-publicacao',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ draft: s.draft }),
    },
  ),
);
