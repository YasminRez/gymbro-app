/**
 * RN-023 — Após 5 tentativas de login inválidas consecutivas, novas tentativas
 * para aquele e-mail ficam bloqueadas por 5 minutos.
 *
 * Funções puras: o modo demonstração usa direto, e a função SQL
 * registrar_tentativa_login (supabase/migrations/0002) segue a mesma regra.
 */
export const MAX_FAILURES = 5;
export const LOCK_MINUTES = 5;

export type AttemptState = { failures: number; lockedUntil: number | null };

export const initialAttempts: AttemptState = { failures: 0, lockedUntil: null };

export function isLocked(state: AttemptState, now: number = Date.now()): boolean {
  return state.lockedUntil !== null && now < state.lockedUntil;
}

export function registerAttempt(
  state: AttemptState,
  success: boolean,
  now: number = Date.now(),
): AttemptState {
  if (success) return initialAttempts;
  // Depois que o bloqueio expira, a contagem recomeça.
  const failures = (state.lockedUntil !== null && now >= state.lockedUntil ? 0 : state.failures) + 1;
  return {
    failures,
    lockedUntil: failures >= MAX_FAILURES ? now + LOCK_MINUTES * 60_000 : null,
  };
}
