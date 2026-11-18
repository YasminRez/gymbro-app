import { create } from 'zustand';

import { emptyProfile, ProfileData } from '@/domain/profile';

/**
 * Rascunho do perfil durante as 3 etapas do onboarding (P1 → P2 → P3).
 * Ao voltar para uma etapa anterior, o que já foi preenchido continua aqui (US-04, cenário 5).
 */
type DraftState = {
  draft: ProfileData;
  update: (patch: Partial<ProfileData>) => void;
  reset: (p?: ProfileData) => void;
};

export const useProfileDraft = create<DraftState>((set) => ({
  draft: emptyProfile,
  update: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
  reset: (p) => set({ draft: p ?? emptyProfile }),
}));
