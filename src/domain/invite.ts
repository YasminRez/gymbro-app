/**
 * US-25 (nova) — Convite para treinar. RN-025: só entre conexões ativas, numa
 * academia de quem convida, de agora até 30 dias, no máximo 3 pendentes por conexão.
 * O banco aplica as mesmas regras (migrations 0010 e 0011).
 */

export type InviteStatus = 'pendente' | 'aceito' | 'recusado' | 'cancelado' | 'expirado';

export type Invite = {
  id: string;
  conexaoId: string;
  /** true = eu enviei */
  enviado: boolean;
  status: InviteStatus;
  inicio: string;
  mensagem: string | null;
  modalidade: string | null;
  criadoEm: string;
  respondidoEm: string | null;
  canceladoPorMim: boolean;
  academia: { id: string; placeId: string; nome: string; endereco: string | null };
  pessoa: { id: string; nome: string; foto: string | null };
};

export const INVITE_MAX_DAYS = 30;
export const INVITE_MAX_PENDING = 3;
export const INVITE_MESSAGE_MAX = 200;
/** Horários sugeridos no pop-up (de hora em hora, das 5h às 22h) */
export const INVITE_HOURS = Array.from({ length: 18 }, (_, i) => i + 5);

export const INVITE_MESSAGES = {
  sent: (nome: string) => `Convite enviado para ${nome}.`,
  accepted: 'Treino confirmado! 💪',
  declined: 'Convite recusado.',
  canceled: 'Convite cancelado.',
  invalidTime: 'Escolha um horário entre agora e os próximos 30 dias.',
  limit: 'Você já tem 3 convites esperando resposta dessa pessoa.',
  invalidGym: 'Escolha uma das suas academias.',
  unavailable: 'Este convite não está mais disponível.',
  generic: 'Não foi possível concluir agora. Tente de novo.',
} as const;

export class InviteError extends Error {}

/** RN-025: horário entre agora e 30 dias */
export function isValidInviteTime(inicio: Date, now: Date = new Date()): boolean {
  const diff = inicio.getTime() - now.getTime();
  return diff > 0 && diff <= INVITE_MAX_DAYS * 86_400_000;
}

/** Monta a data do convite a partir do dia escolhido (0 = hoje) e da hora */
export function inviteDate(dayOffset: number, hour: number, minute = 0, now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, hour, minute, 0, 0);
}

/** Próximos dias para escolher no pop-up: "Hoje", "Amanhã", "Sáb 22" ... */
export function nextDays(
  count = 14,
  now: Date = new Date(),
): { offset: number; label: string; sub: string }[] {
  const WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  return Array.from({ length: count }, (_, offset) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    return {
      offset,
      label: offset === 0 ? 'Hoje' : offset === 1 ? 'Amanhã' : WEEK[d.getDay()],
      sub: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
    };
  });
}

/** Horas que ainda dá para escolher naquele dia (hoje: só depois de agora + 30 min) */
export function availableHours(dayOffset: number, now: Date = new Date()): number[] {
  return INVITE_HOURS.filter(
    (h) => inviteDate(dayOffset, h, 0, now).getTime() - now.getTime() >= 30 * 60_000,
  );
}

/** "Hoje às 07:00", "Amanhã às 19:00", "Sáb, 22/11 às 07:00" */
export function formatInviteDate(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((start(d) - start(now)) / 86_400_000);
  if (days === 0) return `Hoje às ${hora}`;
  if (days === 1) return `Amanhã às ${hora}`;
  const WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  return `${WEEK[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} às ${hora}`;
}

export const STATUS_LABEL: Record<InviteStatus, string> = {
  pendente: 'Aguardando resposta',
  aceito: 'Confirmado',
  recusado: 'Recusado',
  cancelado: 'Cancelado',
  expirado: 'Expirado',
};

/** O que cada pessoa pode fazer com o convite agora */
export function inviteActions(
  i: Invite,
  now: Date = new Date(),
): { accept: boolean; decline: boolean; cancel: boolean } {
  const future = Date.parse(i.inicio) > now.getTime();
  return {
    accept: !i.enviado && i.status === 'pendente' && future,
    decline: !i.enviado && i.status === 'pendente' && future,
    cancel: future && (i.status === 'aceito' || (i.enviado && i.status === 'pendente')),
  };
}

/** Treinos combinados: recebidos pendentes primeiro, depois confirmados, depois enviados; por data */
export function sortUpcoming(list: Invite[]): Invite[] {
  const rank = (i: Invite) => (i.status === 'pendente' && !i.enviado ? 0 : i.status === 'aceito' ? 1 : 2);
  return [...list].sort((a, b) => rank(a) - rank(b) || Date.parse(a.inicio) - Date.parse(b.inicio));
}

export const pendingReceived = (list: Invite[]) =>
  list.filter((i) => !i.enviado && i.status === 'pendente').length;
