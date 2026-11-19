import { newClientId } from '@/domain/chat';
import {
  Comment,
  FEED_MESSAGES,
  FEED_PAGE,
  FeedError,
  FeedTab,
  Post,
  PublishDraft,
  PublishResult,
  Stats,
} from '@/domain/feed';
import { computeStreak } from '@/domain/streak';
import { compressPhoto } from '@/features/profile/api';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

/**
 * Feed e constância (US-15 a US-20). No Supabase, tudo passa pelas funções das
 * migrations 0008/0009 (check-in, sequência, visibilidade e bloqueio no banco).
 * No modo demonstração, publicações de exemplo em memória.
 */

export type MyStats = Stats & { datas: string[]; mes: { data: string; fotoUrl: string; id: string }[] };
export type Liker = { id: string; nome: string; foto: string | null };
export type DeleteResult = {
  eraCheckin: boolean;
  transferidoPara: string | null;
  estatisticas: Stats | null;
};

export type FeedApi = {
  feed(tab: FeedTab, after?: Post): Promise<Post[]>;
  publish(draft: PublishDraft): Promise<PublishResult>;
  like(id: string): Promise<{ curti: boolean; curtidas: number }>;
  likers(id: string): Promise<Liker[]>;
  comments(id: string): Promise<Comment[]>;
  comment(id: string, texto: string): Promise<Comment>;
  editComment(id: string, texto: string): Promise<void>;
  deleteComment(id: string): Promise<void>;
  deletePost(id: string): Promise<DeleteResult>;
  myStats(month?: string): Promise<MyStats>;
};

const fuso = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';

function mapError(message?: string): FeedError {
  const m = message ?? '';
  if (m.includes('TERMO_BLOQUEADO')) return new FeedError(FEED_MESSAGES.blockedTerm);
  if (m.includes('PUBLICACAO_INDISPONIVEL')) return new FeedError(FEED_MESSAGES.unavailable);
  if (m.includes('SEM_FOTO')) return new FeedError(FEED_MESSAGES.noPhoto);
  return new FeedError(FEED_MESSAGES.generic);
}

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw mapError(error.message);
  return data as T;
}

const supabaseApi: FeedApi = {
  feed: (tab, after) =>
    rpc<Post[]>('feed', {
      p_aba: tab,
      p_antes: after?.criadoEm ?? null,
      p_antes_id: after?.id ?? null,
      p_limite: FEED_PAGE,
    }),

  async publish(d) {
    const uid = (await supabase.auth.getSession()).data.session?.user.id;
    if (!uid || !d.fotoUri) throw new FeedError(FEED_MESSAGES.publishFailed);
    // RNF-007: redimensiona e comprime antes do envio. O caminho usa o clientId,
    // então tentar de novo sobrescreve o mesmo arquivo em vez de criar outro.
    let url: string;
    try {
      const uri = d.fotoUri.startsWith('http') ? d.fotoUri : await compressPhoto(d.fotoUri);
      const body = await (await fetch(uri)).arrayBuffer();
      const path = `${uid}/${d.clientId}.jpg`;
      const up = await supabase.storage
        .from('publicacoes')
        .upload(path, body, { contentType: 'image/jpeg', upsert: true });
      if (up.error) throw up.error;
      url = supabase.storage.from('publicacoes').getPublicUrl(path).data.publicUrl;
    } catch {
      throw new FeedError(FEED_MESSAGES.publishFailed);
    }
    try {
      return await rpc<PublishResult>('publicar', {
        p_foto_url: url,
        p_legenda: d.legenda.trim() || null,
        p_modalidade: d.modalidade,
        p_duracao_min: d.duracaoMin,
        p_visibilidade: d.visibilidade,
        p_fuso: fuso(),
        p_client_id: d.clientId,
      });
    } catch (e) {
      throw e instanceof FeedError && e.message !== FEED_MESSAGES.generic
        ? e
        : new FeedError(FEED_MESSAGES.publishFailed);
    }
  },

  like: (id) => rpc('curtir_publicacao', { p_id: id }),
  likers: (id) => rpc('curtidas_da_publicacao', { p_id: id }),
  comments: (id) => rpc('comentarios_da_publicacao', { p_id: id }),
  comment: (id, texto) => rpc('comentar', { p_publicacao: id, p_texto: texto }),
  editComment: (id, texto) => rpc('editar_comentario', { p_id: id, p_texto: texto }),
  deleteComment: (id) => rpc('excluir_comentario', { p_id: id }),
  deletePost: (id) => rpc('excluir_publicacao', { p_id: id }),
  myStats: (month) => rpc('minhas_estatisticas', { p_mes: month ?? null }),
};

/* ------------------------------------------------------------------ */
/* Modo demonstração                                                   */
/* ------------------------------------------------------------------ */

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const daysAgoKey = (n: number) => {
  const d = new Date(Date.now() - n * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

const ME = { id: 'demo-eu', nome: 'Você', foto: null, sequencia: 0 };

const demo = {
  posts: [
    {
      id: 'demo-p1',
      fotoUrl: 'https://picsum.photos/seed/gymbro-perna/800/1000',
      legenda: 'Dia de perna concluído. Agachamento com carga nova 💪',
      duracaoMin: 75,
      modalidade: 'Musculação',
      academia: 'Sua academia',
      visibilidade: 'academia_conexoes',
      checkin: true,
      data: todayKey(),
      criadoEm: hoursAgo(2),
      minha: false,
      curti: false,
      curtidas: 12,
      comentarios: 1,
      autor: { id: 'demo-ana', nome: 'Ana Souza', foto: null, sequencia: 9 },
    },
    {
      id: 'demo-p2',
      fotoUrl: 'https://picsum.photos/seed/gymbro-box/800/1000',
      legenda: 'WOD de hoje: 21-15-9 de thruster e pull-up.',
      duracaoMin: 45,
      modalidade: 'Crossfit',
      academia: 'Box Central',
      visibilidade: 'conexoes',
      checkin: true,
      data: daysAgoKey(1),
      criadoEm: hoursAgo(20),
      minha: false,
      curti: true,
      curtidas: 7,
      comentarios: 0,
      autor: { id: 'demo-diego', nome: 'Diego Rocha', foto: null, sequencia: 12 },
    },
  ] as Post[],
  comments: new Map<string, Comment[]>([
    [
      'demo-p1',
      [
        {
          id: 'demo-c1',
          texto: 'Monstra! Semana que vem eu vou junto.',
          criadoEm: hoursAgo(1),
          editado: false,
          meu: false,
          podeRemover: false,
          autor: { id: 'demo-diego', nome: 'Diego Rocha', foto: null },
        },
      ],
    ],
  ]),
  myCheckins: [daysAgoKey(3), daysAgoKey(2), daysAgoKey(1)],
};

const wait = (ms = 300) => new Promise((r) => setTimeout(r, ms));

function demoStats(): Stats {
  const s = computeStreak(demo.myCheckins, todayKey());
  const month = todayKey().slice(0, 7);
  return {
    totalDiasAtivos: s.totalActiveDays,
    sequenciaAtual: s.currentStreak,
    maiorSequencia: s.longestStreak,
    diasNoMes: new Set(demo.myCheckins.filter((d) => d.startsWith(month))).size,
    hoje: todayKey(),
  };
}

const BLOCKED = ['idiota', 'imbecil', 'otario', 'babaca'];

const demoApi: FeedApi = {
  async feed(tab, after) {
    await wait();
    const list = demo.posts
      .filter((p) =>
        tab === 'conexoes' ? !p.minha : tab === 'academia' ? p.visibilidade === 'academia_conexoes' : true,
      )
      .sort((a, b) => Date.parse(b.criadoEm) - Date.parse(a.criadoEm));
    const start = after ? list.findIndex((p) => p.id === after.id) + 1 : 0;
    return list.slice(start, start + FEED_PAGE);
  },

  async publish(d) {
    await wait(700);
    const existing = demo.posts.find((p) => p.id === `demo-${d.clientId}`);
    const hoje = todayKey();
    const checkin = !existing && !demo.myCheckins.includes(hoje);
    const antes = demoStats().maiorSequencia;
    if (checkin) demo.myCheckins.push(hoje);
    const stats = demoStats();
    const post: Post = existing ?? {
      id: `demo-${d.clientId}`,
      fotoUrl: d.fotoUri!,
      legenda: d.legenda.trim() || null,
      duracaoMin: d.duracaoMin,
      modalidade: d.modalidade,
      academia: 'Sua academia',
      visibilidade: d.visibilidade,
      checkin,
      data: hoje,
      criadoEm: new Date().toISOString(),
      minha: true,
      curti: false,
      curtidas: 0,
      comentarios: 0,
      autor: { ...ME, sequencia: stats.sequenciaAtual },
    };
    if (!existing) demo.posts.unshift(post);
    return {
      publicacao: post,
      checkin,
      novoRecorde: checkin && stats.maiorSequencia >= 2 && stats.maiorSequencia > antes,
      estatisticas: stats,
    };
  },

  async like(id) {
    const p = demo.posts.find((x) => x.id === id);
    if (!p) throw new FeedError(FEED_MESSAGES.unavailable);
    p.curti = !p.curti;
    p.curtidas += p.curti ? 1 : -1;
    return { curti: p.curti, curtidas: p.curtidas };
  },

  async likers(id) {
    await wait();
    const p = demo.posts.find((x) => x.id === id);
    const base = [
      { id: 'demo-bruno', nome: 'Bruno Lima', foto: null },
      { id: 'demo-carla', nome: 'Carla Mendes', foto: null },
    ];
    return p?.curti ? [{ id: ME.id, nome: ME.nome, foto: null }, ...base] : base;
  },

  async comments(id) {
    await wait();
    return [...(demo.comments.get(id) ?? [])];
  },

  async comment(id, texto) {
    await wait();
    const norm = texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    if (BLOCKED.some((t) => new RegExp(`\\b${t}\\b`).test(norm)))
      throw new FeedError(FEED_MESSAGES.blockedTerm);
    const c: Comment = {
      id: `demo-c-${newClientId()}`,
      texto: texto.trim(),
      criadoEm: new Date().toISOString(),
      editado: false,
      meu: true,
      podeRemover: true,
      autor: { id: ME.id, nome: ME.nome, foto: null },
    };
    demo.comments.set(id, [...(demo.comments.get(id) ?? []), c]);
    const p = demo.posts.find((x) => x.id === id);
    if (p) p.comentarios += 1;
    return c;
  },

  async editComment(id, texto) {
    for (const list of demo.comments.values()) {
      const c = list.find((x) => x.id === id);
      if (c) Object.assign(c, { texto: texto.trim(), editado: true });
    }
  },

  async deleteComment(id) {
    for (const [pid, list] of demo.comments) {
      if (list.some((c) => c.id === id)) {
        demo.comments.set(
          pid,
          list.filter((c) => c.id !== id),
        );
        const p = demo.posts.find((x) => x.id === pid);
        if (p) p.comentarios = Math.max(0, p.comentarios - 1);
      }
    }
  },

  async deletePost(id) {
    await wait();
    const p = demo.posts.find((x) => x.id === id);
    if (!p || !p.minha) throw new FeedError(FEED_MESSAGES.generic);
    demo.posts = demo.posts.filter((x) => x.id !== id);
    let transferidoPara: string | null = null;
    if (p.checkin) {
      const other = demo.posts
        .filter((x) => x.minha && x.data === p.data)
        .sort((a, b) => Date.parse(a.criadoEm) - Date.parse(b.criadoEm))[0];
      if (other) {
        other.checkin = true;
        transferidoPara = other.id;
      } else {
        demo.myCheckins = demo.myCheckins.filter((d) => d !== p.data);
      }
    }
    return { eraCheckin: p.checkin, transferidoPara, estatisticas: demoStats() };
  },

  async myStats(month) {
    await wait();
    const m = (month ?? todayKey()).slice(0, 7);
    return {
      ...demoStats(),
      datas: [...demo.myCheckins],
      mes: demo.myCheckins
        .filter((d) => d.startsWith(m))
        .map((d) => ({
          data: d,
          id: d,
          fotoUrl:
            demo.posts.find((p) => p.minha && p.data === d && p.checkin)?.fotoUrl ??
            `https://picsum.photos/seed/gymbro-${d}/200/250`,
        })),
    };
  },
};

export const feedApi: FeedApi = isSupabaseConfigured ? supabaseApi : demoApi;
