import { Visibility } from './feed';

/**
 * Sprint 6 — Engajamento e conta (US-21 a US-24). Regras puras, testadas em
 * src/domain/__tests__/engagement.test.ts. As mesmas regras estão no banco
 * (migration 0013).
 */

/* ---------- US-21: notificações ---------- */

export type NotificationType =
  | 'conexao'
  | 'mensagem'
  | 'curtida'
  | 'comentario'
  | 'convite'
  | 'convite_aceito'
  | 'convite_cancelado'
  | 'lembrete_sequencia';

export type AppNotification = {
  id: string;
  tipo: NotificationType | string;
  referenciaId: string | null;
  conexaoId: string | null;
  lida: boolean;
  criadoEm: string;
  texto: string;
  origem: { id: string; nome: string; foto: string | null } | null;
};

export type NotificationPrefs = {
  matches: boolean;
  mensagens: boolean;
  curtidas: boolean;
  comentarios: boolean;
  convites: boolean;
  lembreteSequencia: boolean;
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  matches: true,
  mensagens: true,
  curtidas: true,
  comentarios: true,
  convites: true,
  lembreteSequencia: true,
};

export const NOTIFICATION_PREF_ITEMS: { key: keyof NotificationPrefs; label: string; hint: string }[] = [
  { key: 'matches', label: 'Novos matches', hint: 'Quando alguém que você curtiu também te curtir' },
  { key: 'mensagens', label: 'Mensagens', hint: 'Mensagens novas das suas conexões' },
  { key: 'convites', label: 'Convites para treinar', hint: 'Convites recebidos, aceitos e cancelados' },
  { key: 'curtidas', label: 'Curtidas', hint: 'Quando curtirem seus treinos' },
  { key: 'comentarios', label: 'Comentários', hint: 'Quando comentarem nos seus treinos' },
  {
    key: 'lembreteSequencia',
    label: 'Lembrete de sequência',
    hint: 'Às 20h, se você ainda não treinou hoje',
  },
];

/** Preferência que controla cada tipo (mesma regra de notificacao_categoria no banco) */
export function prefForType(tipo: string): keyof NotificationPrefs | null {
  if (tipo === 'conexao') return 'matches';
  if (tipo === 'mensagem') return 'mensagens';
  if (tipo === 'curtida') return 'curtidas';
  if (tipo === 'comentario') return 'comentarios';
  if (tipo.startsWith('convite')) return 'convites';
  if (tipo === 'lembrete_sequencia') return 'lembreteSequencia';
  return null;
}

export function shouldNotify(tipo: string, prefs: NotificationPrefs): boolean {
  const k = prefForType(tipo);
  return k ? prefs[k] : true;
}

/** Texto da notificação (mesma regra de notificacao_texto no banco) */
export function notificationText(tipo: string, nomeCompleto?: string | null): string {
  const nome = (nomeCompleto ?? '').trim().split(/\s+/)[0] || 'Alguém';
  switch (tipo) {
    case 'conexao':
      return `Vocês deram match! Mande um oi para ${nomeCompleto ? nome : 'seu novo parceiro'}.`;
    case 'mensagem':
      return `${nome} enviou uma mensagem.`;
    case 'curtida':
      return `${nome} curtiu seu treino.`;
    case 'comentario':
      return `${nome} comentou no seu treino.`;
    case 'convite':
      return `${nome} te convidou para treinar.`;
    case 'convite_aceito':
      return `${nome} aceitou seu convite para treinar.`;
    case 'convite_cancelado':
      return `${nome} cancelou o treino combinado.`;
    case 'lembrete_sequencia':
      return 'Não perca sua sequência! Publique o treino de hoje.';
    default:
      return 'Você tem uma novidade no GymBrô.';
  }
}

export const NOTIFICATION_ICONS: Record<string, string> = {
  conexao: 'flame',
  mensagem: 'chatbubble',
  curtida: 'heart',
  comentario: 'chatbox-ellipses',
  convite: 'calendar',
  convite_aceito: 'checkmark-circle',
  convite_cancelado: 'close-circle',
  lembrete_sequencia: 'alarm',
};

/** Para onde a notificação leva ao ser tocada */
export type NotificationTarget =
  | { kind: 'chat'; id: string }
  | { kind: 'comments'; id: string }
  | { kind: 'publish' }
  | { kind: 'profile'; id: string }
  | null;

export function notificationTarget(
  n: Pick<AppNotification, 'tipo' | 'referenciaId' | 'conexaoId' | 'origem'>,
): NotificationTarget {
  if (n.tipo === 'lembrete_sequencia') return { kind: 'publish' };
  if ((n.tipo === 'curtida' || n.tipo === 'comentario') && n.referenciaId)
    return { kind: 'comments', id: n.referenciaId };
  if (n.conexaoId) return { kind: 'chat', id: n.conexaoId };
  if (n.origem) return { kind: 'profile', id: n.origem.id };
  return null;
}

/** Separa a lista em "Hoje", "Esta semana" e "Anteriores" */
export function groupNotifications<T extends { criadoEm: string }>(
  list: T[],
  now: Date = new Date(),
): { title: string; data: T[] }[] {
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startWeek = startToday - 6 * 86_400_000;
  const groups = { hoje: [] as T[], semana: [] as T[], antes: [] as T[] };
  for (const n of list) {
    const t = new Date(n.criadoEm).getTime();
    if (t >= startToday) groups.hoje.push(n);
    else if (t >= startWeek) groups.semana.push(n);
    else groups.antes.push(n);
  }
  return [
    { title: 'Hoje', data: groups.hoje },
    { title: 'Esta semana', data: groups.semana },
    { title: 'Anteriores', data: groups.antes },
  ].filter((g) => g.data.length > 0);
}

/* ---------- US-22: ranking semanal ---------- */

export type RankingRow = {
  id: string;
  nome: string;
  foto: string | null;
  posicao: number;
  checkins: number;
  sequencia: number;
  souEu: boolean;
};

export type Ranking = {
  academia: { id: string; nome: string } | null;
  inicio: string;
  fim: string;
  hoje?: string;
  lista: RankingRow[];
  eu: RankingRow | null;
};

const pad = (n: number) => String(n).padStart(2, '0');
const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Segunda e domingo da semana de `today` (YYYY-MM-DD) */
export function weekRange(today: string): { inicio: string; fim: string } {
  const [y, m, d] = today.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dow = (date.getDay() + 6) % 7; // segunda = 0
  const ini = new Date(y, m - 1, d - dow);
  const fim = new Date(y, m - 1, d - dow + 6);
  return { inicio: toKey(ini), fim: toKey(fim) };
}

/** "17 a 23 de nov." */
export function weekLabel(inicio: string, fim: string): string {
  const MESES = [
    'jan.',
    'fev.',
    'mar.',
    'abr.',
    'mai.',
    'jun.',
    'jul.',
    'ago.',
    'set.',
    'out.',
    'nov.',
    'dez.',
  ];
  const [, m1, d1] = inicio.split('-').map(Number);
  const [, m2, d2] = fim.split('-').map(Number);
  return m1 === m2
    ? `${d1} a ${d2} de ${MESES[m2 - 1]}`
    : `${d1} de ${MESES[m1 - 1]} a ${d2} de ${MESES[m2 - 1]}`;
}

/** Dias que faltam para a semana do ranking fechar (domingo conta) */
export function daysUntilWeekEnds(today: string): number {
  const { fim } = weekRange(today);
  const [y1, m1, d1] = today.split('-').map(Number);
  const [y2, m2, d2] = fim.split('-').map(Number);
  return (
    Math.round((new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime()) / 86_400_000) + 1
  );
}

/**
 * Posições com empate (mesma regra do rank() do banco): quem tem o mesmo número
 * de check-ins divide a posição; desempate na ordem só pelo check-in mais antigo.
 */
export function rankByCheckins<T extends { checkins: number; ultimo: string }>(
  rows: T[],
): (T & { posicao: number })[] {
  const sorted = [...rows].sort((a, b) => b.checkins - a.checkins || a.ultimo.localeCompare(b.ultimo));
  let last = -1;
  let pos = 0;
  return sorted.map((r, i) => {
    if (r.checkins !== last) {
      pos = i + 1;
      last = r.checkins;
    }
    return { ...r, posicao: pos };
  });
}

/* ---------- US-23: privacidade ---------- */

export type PrivacySettings = {
  mostrarDistancia: boolean;
  visibilidadePadrao: Visibility;
  visivelDescoberta: boolean;
};

export const DEFAULT_PRIVACY: PrivacySettings = {
  mostrarDistancia: true,
  visibilidadePadrao: 'academia_conexoes',
  visivelDescoberta: true,
};

/* ---------- US-24: exclusão de conta (RN-022) ---------- */

export const DELETION_GRACE_DAYS = 30;
export const DELETE_CONFIRM_WORD = 'EXCLUIR';

export type AccountStatus = { status: 'ativo' | 'suspenso' | 'desativado'; excluirEm: string | null };

export function deletionDate(requestedAt: Date): Date {
  return new Date(requestedAt.getTime() + DELETION_GRACE_DAYS * 86_400_000);
}

export function daysUntilDeletion(excluirEm: string, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((new Date(excluirEm).getTime() - now.getTime()) / 86_400_000));
}

export function canConfirmDeletion(word: string, senha: string): boolean {
  return word.trim().toUpperCase() === DELETE_CONFIRM_WORD && senha.length > 0;
}

export function formatDateBR(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
