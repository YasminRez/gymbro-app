/**
 * Feed e constância — regras puras (US-15 a US-20). O banco aplica as mesmas
 * regras (migrations 0008 e 0009); aqui ficam as que a tela precisa antes.
 */

export type Visibility = 'academia_conexoes' | 'conexoes';
export type FeedTab = 'todos' | 'conexoes' | 'academia';

export type PostAuthor = { id: string; nome: string; foto: string | null; sequencia: number };

export type Post = {
  id: string;
  fotoUrl: string;
  legenda: string | null;
  duracaoMin: number | null;
  modalidade: string | null;
  academia: string | null;
  visibilidade: Visibility;
  checkin: boolean;
  data: string;
  criadoEm: string;
  minha: boolean;
  curti: boolean;
  curtidas: number;
  comentarios: number;
  autor: PostAuthor;
};

export type Stats = {
  totalDiasAtivos: number;
  sequenciaAtual: number;
  maiorSequencia: number;
  diasNoMes: number;
  hoje: string;
};

export type PublishResult = { publicacao: Post; checkin: boolean; novoRecorde: boolean; estatisticas: Stats };

export type Comment = {
  id: string;
  texto: string;
  criadoEm: string;
  editado: boolean;
  meu: boolean;
  podeRemover: boolean;
  autor: { id: string; nome: string; foto: string | null };
};

export type PublishDraft = {
  fotoUri: string | null;
  legenda: string;
  modalidade: string | null;
  duracaoMin: number | null;
  visibilidade: Visibility;
  /** id local: o reenvio após falha não duplica a publicação */
  clientId: string;
};

export const CAPTION_MAX = 300;
export const COMMENT_MAX = 300;
export const DURATION_MAX = 600;
export const DURATIONS = [30, 45, 60, 90, 120] as const;
export const FEED_PAGE = 20;

export const VISIBILITIES: { value: Visibility; label: string; hint: string }[] = [
  {
    value: 'academia_conexoes',
    label: 'Minha academia e conexões',
    hint: 'Quem treina na sua academia e suas conexões',
  },
  { value: 'conexoes', label: 'Somente conexões', hint: 'Só seus parceiros de treino' },
];

export const FEED_TABS: { value: FeedTab; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'conexoes', label: 'Conexões' },
  { value: 'academia', label: 'Minha academia' },
];

/** Textos do DRS */
export const FEED_MESSAGES = {
  empty: 'Ainda não há treinos por aqui. Seja o primeiro a publicar hoje!',
  noPhoto: 'Adicione uma foto do seu treino.',
  checkinDone: (n: number) => `Dia ${n} concluído! 🔥`,
  newRecord: (n: number) => `Novo recorde: ${n} dias seguidos!`,
  deleteCheckin:
    'Este é o seu check-in do dia. Excluí-lo vai remover o dia do seu contador e pode afetar sua sequência.',
  blockedTerm: 'Seu comentário contém termos não permitidos.',
  publishFailed: 'Não foi possível publicar. Seu rascunho ficou salvo.',
  unavailable: 'Esta publicação não está mais disponível.',
  generic: 'Não foi possível concluir agora. Tente de novo.',
} as const;

export class FeedError extends Error {}

/** US-15: foto obrigatória, legenda até 300 e duração entre 1 e 600 minutos */
export function canPublish(d: Pick<PublishDraft, 'fotoUri' | 'legenda' | 'duracaoMin'>): boolean {
  if (!d.fotoUri) return false;
  if (d.legenda.trim().length > CAPTION_MAX) return false;
  if (
    d.duracaoMin !== null &&
    (!Number.isInteger(d.duracaoMin) || d.duracaoMin < 1 || d.duracaoMin > DURATION_MAX)
  )
    return false;
  return true;
}

/** RN-020: de 1 a 300 caracteres (a lista de termos bloqueados fica no banco) */
export function canComment(text: string): boolean {
  const n = text.trim().length;
  return n >= 1 && n <= COMMENT_MAX;
}

/** "45 min", "1h", "1h30" */
export function formatDuration(min: number | null): string | null {
  if (!min) return null;
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

/** Tempo da publicação: "agora", "5 min", "3 h", "ontem", "4 d", "12/11" */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const diff = Math.max(0, now.getTime() - Date.parse(iso));
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'ontem';
  if (d < 7) return `${d} d`;
  const date = new Date(iso);
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** US-18: curtida otimista (a tela muda na hora; o servidor confirma depois) */
export function toggleLike(p: Post): Post {
  return { ...p, curti: !p.curti, curtidas: Math.max(0, p.curtidas + (p.curti ? -1 : 1)) };
}

/** Junta páginas do feed sem repetir publicação */
export function appendPage(current: Post[], page: Post[]): Post[] {
  const seen = new Set(current.map((p) => p.id));
  return [...current, ...page.filter((p) => !seen.has(p.id))];
}
