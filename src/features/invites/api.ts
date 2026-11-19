import { Invite, INVITE_MESSAGES, InviteError } from '@/domain/invite';
import { demoPersonById } from '@/features/discovery/api';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

/**
 * US-25 — Convite para treinar (migrations 0010 e 0011).
 * O banco aplica a RN-025; o Realtime avisa quando um convite muda.
 */

export type SendInput = {
  conexaoId: string;
  placeId: string;
  inicio: Date;
  modalidade: string | null;
  mensagem: string;
  /** só para o modo demonstração */
  academiaNome?: string;
};

export type InvitesApi = {
  list(conexaoId?: string): Promise<Invite[]>;
  send(input: SendInput): Promise<Invite>;
  respond(id: string, aceitar: boolean): Promise<Invite>;
  cancel(id: string): Promise<Invite>;
  subscribe(conexaoId: string | null, onChange: () => void): () => void;
};

function mapError(message?: string): InviteError {
  const m = message ?? '';
  if (m.includes('HORARIO_INVALIDO')) return new InviteError(INVITE_MESSAGES.invalidTime);
  if (m.includes('LIMITE_CONVITES')) return new InviteError(INVITE_MESSAGES.limit);
  if (m.includes('ACADEMIA_INVALIDA')) return new InviteError(INVITE_MESSAGES.invalidGym);
  if (m.includes('CONVITE') || m.includes('SEM_CONEXAO')) return new InviteError(INVITE_MESSAGES.unavailable);
  return new InviteError(INVITE_MESSAGES.generic);
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw mapError(error.message);
  return data as T;
}

const supabaseApi: InvitesApi = {
  list: (conexaoId) => rpc('listar_convites', { p_conexao: conexaoId ?? null }),
  send: (i) =>
    rpc('convidar_treino', {
      p_conexao: i.conexaoId,
      p_place_id: i.placeId,
      p_inicio: i.inicio.toISOString(),
      p_modalidade: i.modalidade,
      p_mensagem: i.mensagem.trim() || null,
    }),
  respond: (id, aceitar) => rpc('responder_convite', { p_id: id, p_aceitar: aceitar }),
  cancel: (id) => rpc('cancelar_convite', { p_id: id }),
  subscribe(conexaoId, onChange) {
    const channel = supabase
      .channel(`convites-${conexaoId ?? 'todos'}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'convite_treino',
          ...(conexaoId ? { filter: `conexao_id=eq.${conexaoId}` } : {}),
        },
        () => onChange(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  },
};

/* ---------- Modo demonstração ---------- */

const demo = { list: [] as Invite[], listeners: new Set<() => void>() };
const emit = () => demo.listeners.forEach((fn) => fn());
const wait = (ms = 300) => new Promise((r) => setTimeout(r, ms));

const demoApi: InvitesApi = {
  async list(conexaoId) {
    await wait();
    const now = Date.now();
    return demo.list
      .map((i) =>
        i.status === 'pendente' && Date.parse(i.inicio) < now ? { ...i, status: 'expirado' as const } : i,
      )
      .filter((i) =>
        conexaoId
          ? i.conexaoId === conexaoId
          : ['pendente', 'aceito'].includes(i.status) && Date.parse(i.inicio) > now - 3 * 3_600_000,
      )
      .sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio));
  },
  async send(input) {
    await wait(400);
    if (input.inicio.getTime() <= Date.now()) throw new InviteError(INVITE_MESSAGES.invalidTime);
    const pessoa = demoPersonById(input.conexaoId.replace('demo-conexao-', ''));
    const inv: Invite = {
      id: `demo-convite-${Date.now()}`,
      conexaoId: input.conexaoId,
      enviado: true,
      status: 'pendente',
      inicio: input.inicio.toISOString(),
      mensagem: input.mensagem.trim() || null,
      modalidade: input.modalidade,
      criadoEm: new Date().toISOString(),
      respondidoEm: null,
      canceladoPorMim: false,
      academia: {
        id: input.placeId,
        placeId: input.placeId,
        nome: input.academiaNome ?? 'Sua academia',
        endereco: null,
      },
      pessoa: { id: pessoa?.id ?? 'demo', nome: pessoa?.nome ?? 'Parceiro', foto: pessoa?.fotos[0] ?? null },
    };
    demo.list.push(inv);
    emit();
    // Simula a resposta da outra pessoa
    setTimeout(() => {
      const i = demo.list.find((x) => x.id === inv.id);
      if (i && i.status === 'pendente') {
        i.status = 'aceito';
        i.respondidoEm = new Date().toISOString();
        emit();
      }
    }, 3000);
    return inv;
  },
  async respond(id, aceitar) {
    const i = demo.list.find((x) => x.id === id);
    if (!i) throw new InviteError(INVITE_MESSAGES.unavailable);
    i.status = aceitar ? 'aceito' : 'recusado';
    emit();
    return { ...i };
  },
  async cancel(id) {
    const i = demo.list.find((x) => x.id === id);
    if (!i) throw new InviteError(INVITE_MESSAGES.unavailable);
    i.status = 'cancelado';
    i.canceladoPorMim = true;
    emit();
    return { ...i };
  },
  subscribe(_conexaoId, onChange) {
    demo.listeners.add(onChange);
    return () => demo.listeners.delete(onChange);
  },
};

export const invitesApi: InvitesApi = isSupabaseConfigured ? supabaseApi : demoApi;
