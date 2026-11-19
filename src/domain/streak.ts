/**
 * RN-017 e RN-018 — Contador de dias ativos e sequência.
 *
 * - Só a primeira publicação de cada dia civil conta como check-in (as datas
 *   chegam aqui já sem repetição, no fuso do usuário, no formato AAAA-MM-DD).
 * - 1 dia de descanso por semana (segunda a domingo) mantém a sequência sem somar
 *   dias ativos. O 2º dia sem check-in na mesma semana zera a sequência atual.
 * - Total de dias ativos e maior sequência nunca são zerados.
 * - O dia de hoje sem check-in ainda não conta como falta (o dia não acabou).
 */

export type StreakStats = {
  totalActiveDays: number;
  currentStreak: number;
  longestStreak: number;
  restUsedThisWeek: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function parse(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Segunda-feira = início da semana */
function weekKey(ms: number): number {
  const weekday = (new Date(ms).getUTCDay() + 6) % 7; // 0 = segunda
  return ms - weekday * DAY_MS;
}

export function computeStreak(checkInDates: string[], today: string): StreakStats {
  const days = new Set(checkInDates.map(parse));
  const empty = { totalActiveDays: 0, currentStreak: 0, longestStreak: 0, restUsedThisWeek: false };
  if (days.size === 0) return empty;

  const start = Math.min(...days);
  const end = parse(today);

  let total = 0;
  let current = 0;
  let longest = 0;
  let restUsed = false;
  let week = weekKey(start);

  for (let ms = start; ms <= end; ms += DAY_MS) {
    if (weekKey(ms) !== week) {
      week = weekKey(ms);
      restUsed = false;
    }

    if (days.has(ms)) {
      total += 1;
      current += 1;
      longest = Math.max(longest, current);
    } else if (ms === end) {
      // hoje ainda pode ter check-in
    } else if (!restUsed) {
      restUsed = true;
    } else {
      current = 0;
    }
  }

  return {
    totalActiveDays: total,
    currentStreak: current,
    longestStreak: longest,
    restUsedThisWeek: restUsed,
  };
}

/* ---------- US-16, cenário 2: calendário ---------- */

export type DayStatus = 'checkin' | 'descanso' | 'falta' | 'futuro' | 'hoje';

const toKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * Situação de cada dia, com a mesma regra do computeStreak: o 1º dia sem check-in
 * da semana vira descanso; os outros, falta. Dias antes do 1º check-in ficam de fora.
 */
export function dayStatuses(checkInDates: string[], today: string): Record<string, DayStatus> {
  const days = new Set(checkInDates.map(parse));
  const out: Record<string, DayStatus> = {};
  if (days.size === 0) return out;
  const end = parse(today);
  let week = weekKey(Math.min(...days));
  let restUsed = false;
  for (let ms = Math.min(...days); ms <= end; ms += DAY_MS) {
    if (weekKey(ms) !== week) {
      week = weekKey(ms);
      restUsed = false;
    }
    if (days.has(ms)) out[toKey(ms)] = 'checkin';
    else if (ms === end) out[toKey(ms)] = 'hoje';
    else if (!restUsed) {
      restUsed = true;
      out[toKey(ms)] = 'descanso';
    } else out[toKey(ms)] = 'falta';
  }
  return out;
}

/** Semanas do mês (segunda a domingo), com null nos dias fora do mês. month: 1 a 12 */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const first = Date.UTC(year, month - 1, 1);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lead = (new Date(first).getUTCDay() + 6) % 7;
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 0; d < daysInMonth; d++) cells.push(toKey(first + d * DAY_MS));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
