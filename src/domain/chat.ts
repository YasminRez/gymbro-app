/**
 * Conexões, chat e segurança — regras puras (US-11, US-12, US-13, US-14).
 * O banco aplica as mesmas regras (migration 0006); aqui ficam as que a tela
 * precisa antes de falar com o servidor, todas testadas em __tests__/chat.test.ts.
 */

export type ChatPerson = { id: string; nome: string; foto: string | null };

export type LastMessage = { conteudo: string; enviadaEm: string; minha: boolean };

export type ConnectionItem = {
  id: string;
  criadaEm: string;
  pessoa: ChatPerson;
  ultimaMensagem: LastMessage | null;
  naoLidas: number;
};

export type Conversation = { id: string; ativa: boolean; pessoa: ChatPerson };

/** pendente = aguardando internet (US-12, cenário 4) · erro = o servidor recusou */
export type MessageStatus = 'pendente' | 'erro';

export type ChatMessage = {
  id: string;
  clientId?: string | null;
  conexaoId: string;
  minha: boolean;
  conteudo: string;
  enviadaEm: string;
  lidaEm: string | null;
  status?: MessageStatus;
};

export type BlockedUser = ChatPerson & { desde: string };

export const MESSAGE_MAX = 1000;
/** A partir daqui o contador de caracteres aparece */
export const MESSAGE_COUNTER_FROM = 900;

export const REPORT_REASONS = [
  { value: 'assedio', label: 'Assédio' },
  { value: 'conteudo_improprio', label: 'Conteúdo impróprio' },
  { value: 'perfil_falso', label: 'Perfil falso' },
  { value: 'spam', label: 'Spam' },
  { value: 'outro', label: 'Outro' },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]['value'];
export const REPORT_DESCRIPTION_MAX = 500;

/** Textos do DRS */
export const CHAT_MESSAGES = {
  empty: 'Você ainda não tem conexões. Curta perfis na aba Descobrir!',
  cannotSend: 'Não é possível enviar mensagens para este usuário.',
  undone: 'Conexão desfeita.',
  blocked: (nome: string) => `${nome} foi bloqueado.`,
  unblocked: (nome: string) => `${nome} foi desbloqueado.`,
  reported: 'Obrigado. Nossa equipe vai analisar a denúncia.',
  generic: 'Não foi possível concluir agora. Tente de novo.',
} as const;

export class ChatError extends Error {}

/** US-12: entre 1 e 1000 caracteres, sem contar espaços nas pontas */
export function canSend(text: string): boolean {
  const n = text.trim().length;
  return n >= 1 && n <= MESSAGE_MAX;
}

/** US-11, cenário 1: novas conexões no topo; conversas pela mensagem mais recente */
export function splitConnections(list: ConnectionItem[]): {
  novas: ConnectionItem[];
  conversas: ConnectionItem[];
} {
  const novas = list
    .filter((c) => !c.ultimaMensagem)
    .sort((a, b) => Date.parse(b.criadaEm) - Date.parse(a.criadaEm));
  const conversas = list
    .filter((c) => !!c.ultimaMensagem)
    .sort((a, b) => Date.parse(b.ultimaMensagem!.enviadaEm) - Date.parse(a.ultimaMensagem!.enviadaEm));
  return { novas, conversas };
}

export const totalUnread = (list: ConnectionItem[]) => list.reduce((s, c) => s + c.naoLidas, 0);

/* ---------------- Datas ---------------- */

const pad = (n: number) => String(n).padStart(2, '0');
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const daysBetween = (a: Date, b: Date) => Math.round((startOfDay(b) - startOfDay(a)) / 86_400_000);

const WEEKDAYS = ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.'];
const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

/** Horário da mensagem: "14:05" */
export function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Horário na lista de conversas: "14:05", "Ontem", "seg." ou "12/11" */
export function formatListTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const diff = daysBetween(d, now);
  if (diff <= 0) return formatMessageTime(iso);
  if (diff === 1) return 'Ontem';
  if (diff < 7) return WEEKDAYS[d.getDay()];
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

/** Separador de dia no chat: "Hoje", "Ontem", "12 de novembro" (com ano se for outro) */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const diff = daysBetween(d, now);
  if (diff <= 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  const base = `${d.getDate()} de ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} de ${d.getFullYear()}`;
}

/* ---------------- Lista do chat ---------------- */

export type ChatRow =
  { type: 'msg'; key: string; msg: ChatMessage } | { type: 'day'; key: string; label: string };

/**
 * Recebe as mensagens da mais nova para a mais antiga (ordem da FlatList invertida)
 * e insere o separador de dia depois da última mensagem de cada dia.
 */
export function withDaySeparators(newestFirst: ChatMessage[], now: Date = new Date()): ChatRow[] {
  const rows: ChatRow[] = [];
  newestFirst.forEach((msg, i) => {
    rows.push({ type: 'msg', key: msg.clientId ?? msg.id, msg });
    const next = newestFirst[i + 1];
    const day = startOfDay(new Date(msg.enviadaEm));
    if (!next || startOfDay(new Date(next.enviadaEm)) !== day) {
      rows.push({ type: 'day', key: `dia-${day}`, label: dayLabel(msg.enviadaEm, now) });
    }
  });
  return rows;
}

/**
 * Junta mensagens novas (do Realtime ou do envio) sem duplicar: a mesma mensagem
 * pode chegar pelo retorno do envio e pelo Realtime. Casa por id ou por clientId.
 * Devolve da mais nova para a mais antiga.
 */
export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const out = [...current];
  for (const m of incoming) {
    const i = out.findIndex((x) => x.id === m.id || (!!m.clientId && x.clientId === m.clientId));
    if (i >= 0) out[i] = { ...out[i], ...m, status: m.status };
    else out.push(m);
  }
  return out.sort((a, b) => Date.parse(b.enviadaEm) - Date.parse(a.enviadaEm));
}

/** Id local para a mensagem (vira client_id no banco e evita duplicar ao reenviar) */
export function newClientId(): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
