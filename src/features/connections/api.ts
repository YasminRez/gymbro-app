import {
  BlockedUser,
  CHAT_MESSAGES,
  ChatError,
  ChatMessage,
  ConnectionItem,
  Conversation,
  ReportReason,
} from '@/domain/chat';
import { demoPersonById } from '@/features/discovery/api';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

/**
 * Conexões, chat e segurança (US-11, US-12, US-13, US-14).
 * No Supabase, as regras ficam no banco (migration 0006) e as mensagens chegam
 * pelo Realtime (RNF-004). No modo demonstração, tudo em memória, com respostas
 * automáticas para dar para testar o tempo real sem um segundo celular.
 */

export type Unsubscribe = () => void;

export type ConnectionsApi = {
  list(): Promise<ConnectionItem[]>;
  /** Avisa quando chega mensagem em qualquer conversa (para atualizar a lista) */
  subscribeList(onChange: () => void): Unsubscribe;
  conversation(id: string): Promise<Conversation | null>;
  messages(id: string): Promise<ChatMessage[]>;
  send(id: string, conteudo: string, clientId: string): Promise<ChatMessage>;
  markRead(id: string): Promise<void>;
  /** Mensagens novas e confirmações de leitura em tempo real */
  subscribe(id: string, onMessage: (m: ChatMessage) => void): Unsubscribe;
  undo(id: string): Promise<void>;
  block(userId: string): Promise<void>;
  unblock(userId: string): Promise<void>;
  blocked(): Promise<BlockedUser[]>;
  report(input: {
    userId: string;
    motivo: ReportReason;
    descricao?: string;
    mensagemId?: string;
    publicacaoId?: string;
    comentarioId?: string;
  }): Promise<void>;
};

/** Erro de regra (o servidor recusou) × erro de rede (fica pendente e reenvia) */
export class NetworkError extends Error {}

function mapError(message: string | undefined): Error {
  const m = message ?? '';
  if (m.includes('SEM_CONEXAO') || m.includes('CONEXAO_INEXISTENTE'))
    return new ChatError(CHAT_MESSAGES.cannotSend);
  if (m.includes('MENSAGEM_INVALIDA') || m.includes('ACAO_INVALIDA'))
    return new ChatError(CHAT_MESSAGES.generic);
  if (/fetch|network|timeout|Failed/i.test(m)) return new NetworkError(m);
  return new ChatError(CHAT_MESSAGES.generic);
}

type MensagemRow = {
  id: string;
  conexao_id: string;
  remetente_id: string;
  conteudo: string;
  enviada_em: string;
  lida_em: string | null;
  client_id: string | null;
};

const fromRow = (r: MensagemRow, uid: string | undefined): ChatMessage => ({
  id: r.id,
  clientId: r.client_id,
  conexaoId: r.conexao_id,
  minha: r.remetente_id === uid,
  conteudo: r.conteudo,
  enviadaEm: r.enviada_em,
  lidaEm: r.lida_em,
});

const myId = async () => (await supabase.auth.getSession()).data.session?.user.id;

const supabaseApi: ConnectionsApi = {
  async list() {
    const { data, error } = await supabase.rpc('listar_conexoes');
    if (error) throw mapError(error.message);
    return (data ?? []) as ConnectionItem[];
  },

  subscribeList(onChange) {
    // O RLS do Realtime só entrega mensagens das minhas conversas
    const channel = supabase
      .channel(`conexoes-${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagem' }, () => onChange())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  },

  async conversation(id) {
    const { data, error } = await supabase.rpc('conversa', { p_conexao: id });
    if (error || !data) return null;
    return data as Conversation;
  },

  async messages(id) {
    const uid = await myId();
    const { data, error } = await supabase
      .from('mensagem')
      .select('id, conexao_id, remetente_id, conteudo, enviada_em, lida_em, client_id')
      .eq('conexao_id', id)
      .order('enviada_em', { ascending: false })
      .limit(100);
    if (error) throw mapError(error.message);
    return ((data ?? []) as MensagemRow[]).map((r) => fromRow(r, uid));
  },

  async send(id, conteudo, clientId) {
    let res;
    try {
      res = await supabase.rpc('enviar_mensagem', {
        p_conexao: id,
        p_conteudo: conteudo,
        p_client_id: clientId,
      });
    } catch (e) {
      throw new NetworkError(String(e));
    }
    if (res.error) throw mapError(res.error.message);
    const d = res.data as Omit<ChatMessage, 'minha'>;
    return { ...d, minha: true };
  },

  async markRead(id) {
    await supabase.rpc('marcar_lidas', { p_conexao: id });
  },

  subscribe(id, onMessage) {
    let uid: string | undefined;
    myId().then((u) => (uid = u));
    const filter = `conexao_id=eq.${id}`;
    const channel = supabase
      .channel(`chat-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagem', filter }, (p) =>
        onMessage(fromRow(p.new as MensagemRow, uid)),
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mensagem', filter }, (p) =>
        onMessage(fromRow(p.new as MensagemRow, uid)),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  },

  async undo(id) {
    const { error } = await supabase.rpc('desfazer_conexao', { p_conexao: id });
    if (error) throw mapError(error.message);
  },

  async block(userId) {
    const { error } = await supabase.rpc('bloquear_usuario', { p_id: userId });
    if (error) throw mapError(error.message);
  },

  async unblock(userId) {
    const { error } = await supabase.rpc('desbloquear_usuario', { p_id: userId });
    if (error) throw mapError(error.message);
  },

  async blocked() {
    const { data, error } = await supabase.rpc('listar_bloqueados');
    if (error) throw mapError(error.message);
    return (data ?? []) as BlockedUser[];
  },

  async report({ userId, motivo, descricao, mensagemId, publicacaoId, comentarioId }) {
    const { error } = await supabase.rpc('denunciar', {
      p_denunciado: userId,
      p_motivo: motivo,
      p_descricao: descricao ?? null,
      p_mensagem: mensagemId ?? null,
      p_publicacao: publicacaoId ?? null,
      p_comentario: comentarioId ?? null,
    });
    if (error) throw mapError(error.message);
  },
};

/* ------------------------------------------------------------------ */
/* Modo demonstração                                                   */
/* ------------------------------------------------------------------ */

type DemoConnection = { id: string; pessoa: Conversation['pessoa']; criadaEm: string; ativa: boolean };

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
let seq = 0;
const demoId = () => `demo-msg-${++seq}`;

const demo = {
  conexoes: new Map<string, DemoConnection>(),
  mensagens: new Map<string, ChatMessage[]>(),
  bloqueados: new Map<string, BlockedUser>(),
  listeners: new Map<string, Set<(m: ChatMessage) => void>>(),
  listListeners: new Set<() => void>(),
  seeded: false,
};

const REPLIES = [
  'Fechado! Te encontro lá 💪',
  'Boa! Que horas você chega?',
  'Hoje é dia de perna, bora?',
  'Combinado. Leva a corda que eu levo o giz.',
  'Show! Depois me fala como foi o treino.',
];

function personFor(conexaoId: string) {
  const pessoaId = conexaoId.replace('demo-conexao-', '');
  const p = demoPersonById(pessoaId);
  return p ? { id: p.id, nome: p.nome, foto: p.fotos[0] ?? null } : null;
}

function ensureConnection(id: string): DemoConnection | null {
  seed();
  const found = demo.conexoes.get(id);
  if (found) return found;
  // Conexão criada por um match no modo demonstração (discoveryApi.act)
  const pessoa = personFor(id);
  if (!pessoa || demo.bloqueados.has(pessoa.id)) return null;
  const c = { id, pessoa, criadaEm: new Date().toISOString(), ativa: true };
  demo.conexoes.set(id, c);
  return c;
}

function seed() {
  if (demo.seeded) return;
  demo.seeded = true;
  const ana = personFor('demo-conexao-demo-ana');
  const diego = personFor('demo-conexao-demo-diego');
  if (ana) {
    const id = 'demo-conexao-demo-ana';
    demo.conexoes.set(id, { id, pessoa: ana, criadaEm: minutesAgo(60 * 26), ativa: true });
    demo.mensagens.set(
      id,
      [
        { min: 60 * 25, minha: false, txt: 'Oi! Vi que você também treina perna na segunda 😄' },
        { min: 60 * 25 - 4, minha: true, txt: 'Oi, Ana! Sim, sempre à noite. Você vai hoje?' },
        { min: 32, minha: false, txt: 'Vou sim, umas 19h. Bora dividir o agachamento?' },
        { min: 31, minha: false, txt: 'Tô precisando de alguém pra me dar segurança na carga' },
      ]
        .map((m) => ({
          id: demoId(),
          conexaoId: id,
          minha: m.minha,
          conteudo: m.txt,
          enviadaEm: minutesAgo(m.min),
          lidaEm: m.minha ? minutesAgo(m.min - 1) : null,
        }))
        .reverse(),
    );
  }
  if (diego) {
    const id = 'demo-conexao-demo-diego';
    demo.conexoes.set(id, { id, pessoa: diego, criadaEm: minutesAgo(15), ativa: true });
  }
}

function emit(id: string, m: ChatMessage) {
  demo.listeners.get(id)?.forEach((fn) => fn(m));
  demo.listListeners.forEach((fn) => fn());
}

const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));

const demoApi: ConnectionsApi = {
  async list() {
    seed();
    await wait();
    return [...demo.conexoes.values()]
      .filter((c) => c.ativa && !demo.bloqueados.has(c.pessoa.id))
      .map((c) => {
        const msgs = demo.mensagens.get(c.id) ?? [];
        const last = msgs[0];
        return {
          id: c.id,
          criadaEm: c.criadaEm,
          pessoa: c.pessoa,
          ultimaMensagem: last
            ? { conteudo: last.conteudo, enviadaEm: last.enviadaEm, minha: last.minha }
            : null,
          naoLidas: msgs.filter((m) => !m.minha && !m.lidaEm).length,
        };
      });
  },

  subscribeList(onChange) {
    demo.listListeners.add(onChange);
    return () => demo.listListeners.delete(onChange);
  },

  async conversation(id) {
    const c = ensureConnection(id);
    if (!c) return null;
    return { id: c.id, ativa: c.ativa && !demo.bloqueados.has(c.pessoa.id), pessoa: c.pessoa };
  },

  async messages(id) {
    ensureConnection(id);
    await wait();
    const c = demo.conexoes.get(id);
    return c?.ativa ? [...(demo.mensagens.get(id) ?? [])] : [];
  },

  async send(id, conteudo, clientId) {
    const c = ensureConnection(id);
    if (!c || !c.ativa) throw new ChatError(CHAT_MESSAGES.cannotSend);
    await wait(300);
    const list = demo.mensagens.get(id) ?? [];
    const existing = list.find((m) => m.clientId === clientId);
    if (existing) return existing;
    const m: ChatMessage = {
      id: demoId(),
      clientId,
      conexaoId: id,
      minha: true,
      conteudo: conteudo.trim(),
      enviadaEm: new Date().toISOString(),
      lidaEm: null,
    };
    demo.mensagens.set(id, [m, ...list]);
    demo.listListeners.forEach((fn) => fn());

    // Simula a outra pessoa: lê em 1,2 s e responde em 2,5 s
    setTimeout(() => {
      const lida = { ...m, lidaEm: new Date().toISOString() };
      demo.mensagens.set(
        id,
        (demo.mensagens.get(id) ?? []).map((x) => (x.id === m.id ? lida : x)),
      );
      emit(id, lida);
    }, 1200);
    setTimeout(() => {
      if (!demo.conexoes.get(id)?.ativa) return;
      const reply: ChatMessage = {
        id: demoId(),
        conexaoId: id,
        minha: false,
        conteudo: REPLIES[seq % REPLIES.length],
        enviadaEm: new Date().toISOString(),
        lidaEm: null,
      };
      demo.mensagens.set(id, [reply, ...(demo.mensagens.get(id) ?? [])]);
      emit(id, reply);
    }, 2500);
    return m;
  },

  async markRead(id) {
    const now = new Date().toISOString();
    demo.mensagens.set(
      id,
      (demo.mensagens.get(id) ?? []).map((m) => (!m.minha && !m.lidaEm ? { ...m, lidaEm: now } : m)),
    );
    demo.listListeners.forEach((fn) => fn());
  },

  subscribe(id, onMessage) {
    const set = demo.listeners.get(id) ?? new Set();
    set.add(onMessage);
    demo.listeners.set(id, set);
    return () => set.delete(onMessage);
  },

  async undo(id) {
    await wait();
    const c = demo.conexoes.get(id);
    if (!c || !c.ativa) throw new ChatError(CHAT_MESSAGES.cannotSend);
    c.ativa = false;
    demo.listListeners.forEach((fn) => fn());
  },

  async block(userId) {
    await wait();
    const c = [...demo.conexoes.values()].find((x) => x.pessoa.id === userId);
    const p =
      c?.pessoa ??
      (() => {
        const d = demoPersonById(userId);
        return d
          ? { id: d.id, nome: d.nome, foto: d.fotos[0] ?? null }
          : { id: userId, nome: 'Usuário', foto: null };
      })();
    demo.bloqueados.set(userId, { ...p, desde: new Date().toISOString() });
    if (c) c.ativa = false;
    demo.listListeners.forEach((fn) => fn());
  },

  async unblock(userId) {
    await wait();
    demo.bloqueados.delete(userId); // a conexão anterior não volta (US-13, cenário 2)
  },

  async blocked() {
    await wait();
    return [...demo.bloqueados.values()].sort((a, b) => Date.parse(b.desde) - Date.parse(a.desde));
  },

  async report() {
    await wait(400);
  },
};

export const connectionsApi: ConnectionsApi = isSupabaseConfigured ? supabaseApi : demoApi;
