import { create } from 'zustand';

import { CURRENT_TERMS_VERSION } from '@/constants/legal';
import { GymLink } from '@/domain/gyms';
import { missingForDiscovery, MissingItem, ProfileData } from '@/domain/profile';
import { authApi, AuthUser } from '@/features/auth/api';
import { engagementApi } from '@/features/engagement/api';
import { profileApi } from '@/features/profile/api';

/**
 * Estado de sessão do app — decide quais rotas ficam liberadas (src/app/_layout.tsx).
 * profileComplete segue a RN-006: 1 foto, 1 modalidade, 1 objetivo, 1 período e academia principal.
 */
type SessionState = {
  ready: boolean;
  user: AuthUser | null;
  signedIn: boolean;
  termsAccepted: boolean;
  profile: ProfileData | null;
  gyms: GymLink[];
  missing: MissingItem[];
  profileComplete: boolean;
  /** US-24 / RN-022: data da exclusão definitiva, se a conta estiver em carência */
  deletionAt: string | null;
  /** Conta desativada e com exclusão marcada para deletionAt */
  setDeletion: (excluirEm: string | null) => void;
  /** Liga a escuta da sessão. Chamar uma vez no layout raiz. */
  init: () => () => void;
  /** Recarrega perfil e academias do banco */
  refresh: () => Promise<void>;
  setProfile: (p: ProfileData) => void;
  setGyms: (g: GymLink[]) => void;
  signOut: () => Promise<void>;
};

const derive = (profile: ProfileData | null, gyms: GymLink[]) => {
  const missing = missingForDiscovery(
    profile,
    gyms.some((g) => g.tipo === 'principal'),
  );
  return { profile, gyms, missing, profileComplete: missing.length === 0 };
};

export const useSession = create<SessionState>((set, get) => ({
  ready: false,
  user: null,
  signedIn: false,
  termsAccepted: false,
  profile: null,
  gyms: [],
  missing: [],
  profileComplete: false,
  deletionAt: null,

  init: () =>
    authApi.subscribe(async (user) => {
      if (!user) {
        set({
          ready: true,
          user: null,
          signedIn: false,
          termsAccepted: false,
          deletionAt: null,
          ...derive(null, []),
        });
        return;
      }
      const [profile, gyms, status] = await Promise.all([
        profileApi.load(user.id).catch(() => null),
        profileApi.loadGyms(user.id).catch(() => []),
        engagementApi.accountStatus().catch(() => null),
      ]);
      set({
        ready: true,
        user,
        signedIn: true,
        termsAccepted: user.termsVersion === CURRENT_TERMS_VERSION,
        deletionAt: status?.status === 'desativado' ? status.excluirEm : null,
        ...derive(profile, gyms),
      });
    }),

  refresh: async () => {
    const user = get().user;
    if (!user) return;
    const [profile, gyms] = await Promise.all([profileApi.load(user.id), profileApi.loadGyms(user.id)]);
    set(derive(profile, gyms));
  },

  setProfile: (p) => set(derive(p, get().gyms)),
  setGyms: (g) => set(derive(get().profile, g)),
  setDeletion: (deletionAt) => set({ deletionAt }),

  signOut: async () => {
    await authApi.signOut();
  },
}));

/** Rota do onboarding que resolve o primeiro item pendente (US-04, cenário 4) */
export function onboardingRoute(missing: MissingItem[]): '/perfil-fotos' | '/localizacao' {
  return missing.some((m) => m !== 'academia') ? '/perfil-fotos' : '/localizacao';
}
