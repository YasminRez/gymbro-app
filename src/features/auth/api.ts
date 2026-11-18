import * as Linking from 'expo-linking';

import { CURRENT_TERMS_VERSION } from '@/constants/legal';
import { initialAttempts, isLocked, registerAttempt, AttemptState } from '@/domain/login-attempts';
import { toISODate } from '@/domain/masks';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

/**
 * Camada de autenticação (US-01, US-02, US-03).
 * Com o .env preenchido usa o Supabase. Sem ele, usa um "modo demonstração" em
 * memória com as mesmas regras, para testar as telas no Expo Go sem back-end.
 */

export const AUTH_MESSAGES = {
  emailExists: 'Já existe uma conta vinculada a este e-mail.',
  underage: 'O GymBrô é permitido apenas para maiores de 18 anos.',
  invalidCredentials: 'E-mail ou senha inválidos.',
  locked: 'Muitas tentativas. Tente novamente em 5 minutos.',
  resetSent: 'Se o e-mail estiver cadastrado, você receberá as instruções de redefinição.',
  confirmEmail: 'Enviamos um link de confirmação para o seu e-mail. Confirme e depois entre.',
  generic: 'Não foi possível concluir agora. Verifique sua internet e tente de novo.',
} as const;

export class AuthError extends Error {}

export type SignUpInput = { nome: string; email: string; nascimento: Date; senha: string };
export type SignUpResult = { needsEmailConfirmation: boolean };

export type AuthUser = { id: string; nome: string; termsVersion: string | null };

type AuthApi = {
  signUp(input: SignUpInput): Promise<SignUpResult>;
  signIn(email: string, senha: string): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  updatePassword(senha: string): Promise<void>;
  acceptTerms(): Promise<void>;
  signOut(): Promise<void>;
  /** Escuta mudanças de sessão. Devolve a função para parar de escutar. */
  subscribe(listener: (user: AuthUser | null) => void): () => void;
};

const normalize = (email: string) => email.trim().toLowerCase();

/* ------------------------------------------------------------------ */
/* Supabase                                                            */
/* ------------------------------------------------------------------ */

async function loadUser(id: string, fallbackName: string): Promise<AuthUser> {
  const [{ data: perfil }, { data: aceite }] = await Promise.all([
    supabase.from('usuario').select('nome').eq('id', id).maybeSingle(),
    supabase
      .from('aceite_termos')
      .select('versao')
      .eq('usuario_id', id)
      .order('aceito_em', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  return { id, nome: perfil?.nome ?? fallbackName, termsVersion: aceite?.versao ?? null };
}

const supabaseApi: AuthApi = {
  async signUp({ nome, email, nascimento, senha }) {
    const { data, error } = await supabase.auth.signUp({
      email: normalize(email),
      password: senha,
      options: {
        // O trigger criar_usuario (migration 0002) usa estes dados para criar o
        // registro em "usuario" e o aceite dos termos (RN-004, RN-005).
        data: {
          nome: nome.trim(),
          data_nascimento: toISODate(nascimento),
          termos_versao: CURRENT_TERMS_VERSION,
        },
      },
    });
    if (error) {
      if (/already registered|already exists/i.test(error.message))
        throw new AuthError(AUTH_MESSAGES.emailExists);
      if (/database error/i.test(error.message)) throw new AuthError(AUTH_MESSAGES.underage);
      throw new AuthError(AUTH_MESSAGES.generic);
    }
    // Com confirmação de e-mail ligada, o Supabase não acusa e-mail repetido:
    // devolve um usuário sem identidades.
    if (data.user && data.user.identities?.length === 0) throw new AuthError(AUTH_MESSAGES.emailExists);
    return { needsEmailConfirmation: !data.session };
  },

  async signIn(email, senha) {
    const e = normalize(email);
    const { data: bloqueadoAte } = await supabase.rpc('login_bloqueado_ate', { p_email: e });
    if (bloqueadoAte && new Date(bloqueadoAte) > new Date()) throw new AuthError(AUTH_MESSAGES.locked);

    const { error } = await supabase.auth.signInWithPassword({ email: e, password: senha });
    const { data: novoBloqueio } = await supabase.rpc('registrar_tentativa_login', {
      p_email: e,
      p_sucesso: !error,
    });
    if (error) {
      if (novoBloqueio && new Date(novoBloqueio) > new Date()) throw new AuthError(AUTH_MESSAGES.locked);
      if (/invalid login credentials/i.test(error.message))
        throw new AuthError(AUTH_MESSAGES.invalidCredentials);
      if (/email not confirmed/i.test(error.message)) throw new AuthError(AUTH_MESSAGES.confirmEmail);
      throw new AuthError(AUTH_MESSAGES.generic);
    }
  },

  async sendPasswordReset(email) {
    // O link abre o app na tela "nova-senha". A validade de 30 min é configurada
    // no painel do Supabase (Authentication > Email > OTP expiry = 1800).
    await supabase.auth.resetPasswordForEmail(normalize(email), {
      redirectTo: Linking.createURL('/nova-senha'),
    });
    // Sempre a mesma resposta, para não revelar se o e-mail existe.
  },

  async updatePassword(senha) {
    const { error } = await supabase.auth.updateUser({ password: senha });
    if (error) throw new AuthError(AUTH_MESSAGES.generic);
  },

  async acceptTerms() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw new AuthError(AUTH_MESSAGES.generic);
    const { error } = await supabase
      .from('aceite_termos')
      .insert({ usuario_id: data.user.id, versao: CURRENT_TERMS_VERSION });
    if (error) throw new AuthError(AUTH_MESSAGES.generic);
  },

  async signOut() {
    await supabase.auth.signOut(); // apaga o token do cofre seguro
  },

  subscribe(listener) {
    const emit = async (session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']) => {
      if (!session) return listener(null);
      const meta = session.user.user_metadata as { nome?: string };
      try {
        listener(await loadUser(session.user.id, meta.nome ?? ''));
      } catch {
        listener({ id: session.user.id, nome: meta.nome ?? '', termsVersion: CURRENT_TERMS_VERSION });
      }
    };
    supabase.auth.getSession().then(({ data }) => emit(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return; // já tratado pelo getSession acima
      // Não chamar o Supabase direto dentro do callback (recomendação da lib).
      setTimeout(() => emit(session), 0);
    });
    return () => data.subscription.unsubscribe();
  },
};

/* ------------------------------------------------------------------ */
/* Modo demonstração (sem back-end)                                    */
/* ------------------------------------------------------------------ */

type DemoAccount = { id: string; nome: string; senha: string; termsVersion: string };
const demoAccounts = new Map<string, DemoAccount>([
  [
    'demo@gymbro.app',
    { id: 'demo', nome: 'Visitante', senha: 'Gym@2026', termsVersion: CURRENT_TERMS_VERSION },
  ],
]);
const demoAttempts = new Map<string, AttemptState>();
let demoCurrent: AuthUser | null = null;
const demoListeners = new Set<(u: AuthUser | null) => void>();
const demoEmit = () => demoListeners.forEach((l) => l(demoCurrent));
const wait = () => new Promise((r) => setTimeout(r, 400));

const demoApi: AuthApi = {
  async signUp({ nome, email, senha }) {
    await wait();
    const e = normalize(email);
    if (demoAccounts.has(e)) throw new AuthError(AUTH_MESSAGES.emailExists);
    const acc = { id: e, nome: nome.trim(), senha, termsVersion: CURRENT_TERMS_VERSION };
    demoAccounts.set(e, acc);
    demoCurrent = { id: acc.id, nome: acc.nome, termsVersion: acc.termsVersion };
    demoEmit();
    return { needsEmailConfirmation: false };
  },

  async signIn(email, senha) {
    await wait();
    const e = normalize(email);
    const state = demoAttempts.get(e) ?? initialAttempts;
    if (isLocked(state)) throw new AuthError(AUTH_MESSAGES.locked);
    const acc = demoAccounts.get(e);
    const ok = !!acc && acc.senha === senha;
    const next = registerAttempt(state, ok);
    demoAttempts.set(e, next);
    if (!ok) throw new AuthError(isLocked(next) ? AUTH_MESSAGES.locked : AUTH_MESSAGES.invalidCredentials);
    demoCurrent = { id: acc.id, nome: acc.nome, termsVersion: acc.termsVersion };
    demoEmit();
  },

  async sendPasswordReset() {
    await wait();
  },

  async updatePassword() {
    await wait();
  },

  async acceptTerms() {
    if (demoCurrent) demoCurrent = { ...demoCurrent, termsVersion: CURRENT_TERMS_VERSION };
    demoEmit();
  },

  async signOut() {
    demoCurrent = null;
    demoEmit();
  },

  subscribe(listener) {
    demoListeners.add(listener);
    listener(demoCurrent);
    return () => demoListeners.delete(listener);
  },
};

export const authApi: AuthApi = isSupabaseConfigured ? supabaseApi : demoApi;
export const DEMO_LOGIN = { email: 'demo@gymbro.app', senha: 'Gym@2026' };
