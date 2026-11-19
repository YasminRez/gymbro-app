import {
  AccountStatus,
  AppNotification,
  DEFAULT_NOTIFICATION_PREFS,
  DEFAULT_PRIVACY,
  deletionDate,
  NotificationPrefs,
  notificationText,
  PrivacySettings,
  Ranking,
  weekRange,
} from '@/domain/engagement';
import { demoPersonById } from '@/features/discovery/api';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

/**
 * Engajamento e conta (US-21 a US-24). No Supabase, tudo passa pelas funções da
 * migration 0013 (preferências, ranking, privacidade e exclusão no banco).
 * No modo demonstração, dados de exemplo em memória.
 */

export class EngagementError extends Error {}

export const ENGAGEMENT_MESSAGES = {
  generic: 'Não foi possível concluir agora. Verifique sua internet e tente de novo.',
  wrongPassword: 'Senha incorreta.',
} as const;

export type EngagementApi = {
  notifications(before?: string): Promise<AppNotification[]>;
  unreadCount(): Promise<number>;
  markRead(ids?: string[]): Promise<void>;
  /** Avisa quando chega notificação nova */
  subscribe(onNew: (n: { id: string; tipo: string; origemId: string | null }) => void): () => void;
  prefs(): Promise<NotificationPrefs>;
  savePrefs(p: NotificationPrefs): Promise<NotificationPrefs>;
  registerPushToken(token: string | null): Promise<void>;
  /** placeId da academia (padrão: a principal) */
  ranking(placeId?: string): Promise<Ranking>;
  privacy(): Promise<PrivacySettings>;
  savePrivacy(p: PrivacySettings): Promise<PrivacySettings>;
  accountStatus(): Promise<AccountStatus | null>;
  /** Confere a senha de novo (RNF-002) e pede a exclusão. Devolve a data da exclusão definitiva. */
  requestDeletion(senha: string): Promise<string>;
  cancelDeletion(): Promise<void>;
};

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new EngagementError(ENGAGEMENT_MESSAGES.generic);
  return data as T;
}

const supabaseApi: EngagementApi = {
  notifications: (before) => rpc('listar_notificacoes', { p_antes: before ?? null, p_limite: 30 }),
  unreadCount: () => rpc('contar_notificacoes_nao_lidas'),
  markRead: (ids) => rpc('marcar_notificacoes_lidas', { p_ids: ids ?? null }),

  subscribe(onNew) {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let closed = false;
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user.id;
      if (!uid || closed) return;
      channel = supabase
        .channel(`notificacoes-${uid}-${Date.now()}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notificacao', filter: `usuario_id=eq.${uid}` },
          (payload) => {
            const r = payload.new as { id: string; tipo: string; origem_id: string | null };
            onNew({ id: r.id, tipo: r.tipo, origemId: r.origem_id });
          },
        )
        .subscribe();
    });
    return () => {
      closed = true;
      if (channel) supabase.removeChannel(channel);
    };
  },

  prefs: async () =>
    (await rpc<NotificationPrefs | null>('minhas_preferencias_notificacao')) ?? DEFAULT_NOTIFICATION_PREFS,
  savePrefs: (p) => rpc('salvar_preferencias_notificacao', { p }),
  registerPushToken: (token) => rpc('registrar_push_token', { p_token: token ?? '' }),

  ranking: (placeId) => rpc('ranking_semanal_place', { p_place: placeId ?? null }),

  privacy: async () => (await rpc<PrivacySettings | null>('minha_privacidade')) ?? DEFAULT_PRIVACY,
  savePrivacy: (p) =>
    rpc('salvar_privacidade', {
      p_mostrar_distancia: p.mostrarDistancia,
      p_visibilidade_padrao: p.visibilidadePadrao,
      p_visivel_descoberta: p.visivelDescoberta,
    }),

  accountStatus: () => rpc('status_conta'),

  async requestDeletion(senha) {
    const { data } = await supabase.auth.getUser();
    const email = data.user?.email;
    if (!email) throw new EngagementError(ENGAGEMENT_MESSAGES.generic);
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    if (error) {
      throw new EngagementError(
        /invalid login credentials/i.test(error.message)
          ? ENGAGEMENT_MESSAGES.wrongPassword
          : ENGAGEMENT_MESSAGES.generic,
      );
    }
    const r = await rpc<{ excluirEm: string }>('solicitar_exclusao_conta');
    return r.excluirEm;
  },

  cancelDeletion: () => rpc('cancelar_exclusao_conta'),
};

/* ------------------------------------------------------------------ */
/* Modo demonstração                                                   */
/* ------------------------------------------------------------------ */

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const pessoa = (id: string) => {
  const p = demoPersonById(id);
  return p ? { id: p.id, nome: p.nome, foto: p.fotos[0] ?? null } : null;
};
const demoNotif = (
  id: string,
  tipo: string,
  origemId: string | null,
  min: number,
  extra: Partial<AppNotification> = {},
): AppNotification => {
  const origem = origemId ? pessoa(origemId) : null;
  return {
    id,
    tipo,
    referenciaId: null,
    conexaoId: null,
    lida: false,
    criadoEm: minutesAgo(min),
    texto: notificationText(tipo, origem?.nome),
    origem,
    ...extra,
  };
};

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const demo = {
  notifications: [
    demoNotif('demo-n1', 'curtida', 'demo-ana', 12, { referenciaId: 'demo-p1' }),
    demoNotif('demo-n2', 'comentario', 'demo-diego', 55, { referenciaId: 'demo-p1' }),
    demoNotif('demo-n3', 'conexao', 'demo-carla', 60 * 26, { conexaoId: 'demo-conexao-demo-carla' }),
    demoNotif('demo-n4', 'lembrete_sequencia', null, 60 * 50, { lida: true }),
    demoNotif('demo-n5', 'convite_aceito', 'demo-bruno', 60 * 24 * 9, { lida: true }),
  ] as AppNotification[],
  prefs: { ...DEFAULT_NOTIFICATION_PREFS },
  privacy: { ...DEFAULT_PRIVACY },
  status: { status: 'ativo', excluirEm: null } as AccountStatus,
};

const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));

const demoApi: EngagementApi = {
  async notifications(before) {
    await wait();
    return demo.notifications.filter((n) => !before || n.criadoEm < before);
  },
  async unreadCount() {
    return demo.notifications.filter((n) => !n.lida).length;
  },
  async markRead(ids) {
    demo.notifications = demo.notifications.map((n) =>
      !ids || ids.includes(n.id) ? { ...n, lida: true } : n,
    );
  },
  subscribe() {
    return () => undefined;
  },
  async prefs() {
    return { ...demo.prefs };
  },
  async savePrefs(p) {
    await wait();
    demo.prefs = { ...p };
    return { ...demo.prefs };
  },
  async registerPushToken() {},

  async ranking() {
    await wait();
    const { inicio, fim } = weekRange(todayKey());
    const rows = [
      { id: 'demo-diego', checkins: 6, sequencia: 12 },
      { id: 'demo-ana', checkins: 5, sequencia: 9 },
      { id: 'demo-eu', checkins: 3, sequencia: 3 },
      { id: 'demo-felipe', checkins: 3, sequencia: 4 },
      { id: 'demo-carla', checkins: 2, sequencia: 2 },
      { id: 'demo-bruno', checkins: 1, sequencia: 1 },
    ];
    let last = -1;
    let pos = 0;
    const lista = rows.map((r, i) => {
      if (r.checkins !== last) {
        pos = i + 1;
        last = r.checkins;
      }
      const p = r.id === 'demo-eu' ? { id: 'demo-eu', nome: 'Você', foto: null } : pessoa(r.id);
      return {
        ...r,
        nome: p?.nome ?? 'Pessoa',
        foto: p?.foto ?? null,
        posicao: pos,
        souEu: r.id === 'demo-eu',
      };
    });
    return {
      academia: { id: 'demo-gym', nome: 'Sua academia' },
      inicio,
      fim,
      hoje: todayKey(),
      lista,
      eu: lista.find((r) => r.souEu) ?? null,
    };
  },

  async privacy() {
    return { ...demo.privacy };
  },
  async savePrivacy(p) {
    await wait();
    demo.privacy = { ...p };
    return { ...demo.privacy };
  },

  async accountStatus() {
    return demo.status;
  },
  async requestDeletion(senha) {
    await wait(400);
    if (senha !== 'Gym@2026') throw new EngagementError(ENGAGEMENT_MESSAGES.wrongPassword);
    const excluirEm = deletionDate(new Date()).toISOString();
    demo.status = { status: 'desativado', excluirEm };
    return excluirEm;
  },
  async cancelDeletion() {
    demo.status = { status: 'ativo', excluirEm: null };
  },
};

export const engagementApi: EngagementApi = isSupabaseConfigured ? supabaseApi : demoApi;
