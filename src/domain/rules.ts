/**
 * Regras de negócio do DRS que rodam no app (validação imediata para o usuário).
 * As mesmas regras precisam existir no banco (constraints, RLS e funções) para não
 * depender só do cliente — ver docs/PLANO_DE_DESENVOLVIMENTO.md.
 */

/* RN-002 — Política de senha forte */
export const PASSWORD_ERROR =
  'A senha deve conter no mínimo 8 caracteres, incluindo letra maiúscula, minúscula, número e caractere especial.';

export function isStrongPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

/* RN-004 — Idade mínima de 18 anos */
export function ageOn(birthDate: Date, today: Date = new Date()): number {
  let age = today.getFullYear() - birthDate.getFullYear();
  const beforeBirthday =
    today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export const isAdult = (birthDate: Date, today?: Date) => ageOn(birthDate, today) >= 18;

/* RN-007 — Limites do perfil */
export const PROFILE_LIMITS = {
  photos: { min: 1, max: 6 },
  bioMax: 500,
  interests: { min: 3, max: 10 },
} as const;

/* RN-010 — Raio de busca */
export const SEARCH_RADIUS_KM = { min: 1, max: 50, default: 5 } as const;

/* RN-012 — Limite diário de curtidas */
export const DAILY_LIKE_LIMIT = 100;
export const canLike = (likesToday: number) => likesToday < DAILY_LIKE_LIMIT;

/* RN-020 — Regras de comentários (o filtro de palavras fica no servidor) */
export const isValidCommentLength = (text: string) => {
  const len = text.trim().length;
  return len >= 1 && len <= 300;
};

/* RN-011 — Conexão somente por curtida mútua */
export type Like = { from: string; to: string };

export function isMutualLike(likes: Like[], a: string, b: string): boolean {
  const aLikedB = likes.some((l) => l.from === a && l.to === b);
  const bLikedA = likes.some((l) => l.from === b && l.to === a);
  return aLikedB && bLikedA;
}

/* RN-024 — Cálculo de compatibilidade (0 a 100%) */
export type Slot = { day: number; period: 'manha' | 'tarde' | 'noite' };

export type CompatProfile = {
  mainGymId: string;
  secondaryGymIds: string[];
  slots: Slot[];
  goals: string[];
  modalities: string[];
  interests: string[];
};

/**
 * Proporção de itens em comum. Usamos o menor conjunto como base, para quem tem
 * poucos itens não ser penalizado. Confirmar essa interpretação com o grupo.
 */
function overlap<T>(a: T[], b: T[], key: (x: T) => string = String): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b.map(key));
  const shared = new Set(a.map(key).filter((k) => setB.has(k))).size;
  return shared / Math.min(new Set(a.map(key)).size, setB.size);
}

export function compatibility(a: CompatProfile, b: CompatProfile): number {
  let gym = 0;
  if (a.mainGymId === b.mainGymId) gym = 40;
  else if (a.secondaryGymIds.includes(b.mainGymId) || b.secondaryGymIds.includes(a.mainGymId)) gym = 20;

  const score =
    gym +
    25 * overlap(a.slots, b.slots, (s) => `${s.day}-${s.period}`) +
    15 * overlap(a.goals, b.goals) +
    10 * overlap(a.modalities, b.modalities) +
    10 * overlap(a.interests, b.interests);

  return Math.round(Math.min(100, score));
}
