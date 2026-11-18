import { create } from 'zustand';

import { Candidate, DiscoveryFilters, emptyFilters } from '@/domain/discovery';

/**
 * Estado da aba Descobrir: filtros rápidos (US-08, cenário 2), perfis já carregados
 * (para abrir o perfil completo sem nova consulta) e o último match (tela D7).
 */
type MatchInfo = { conexaoId: string | null; pessoa: Candidate };

type DiscoveryState = {
  filters: DiscoveryFilters;
  cache: Record<string, Candidate>;
  lastMatch: MatchInfo | null;
  setFilters: (f: DiscoveryFilters) => void;
  remember: (list: Candidate[]) => void;
  setMatch: (m: MatchInfo | null) => void;
};

export const useDiscovery = create<DiscoveryState>((set) => ({
  filters: emptyFilters,
  cache: {},
  lastMatch: null,
  setFilters: (filters) => set({ filters }),
  remember: (list) =>
    set((s) => ({ cache: { ...s.cache, ...Object.fromEntries(list.map((c) => [c.id, c])) } })),
  setMatch: (lastMatch) => set({ lastMatch }),
}));
