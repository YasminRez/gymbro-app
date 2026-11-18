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
