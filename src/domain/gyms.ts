/** Academias: distância, vínculo e regras (US-06, US-07, RN-008, RN-009, RN-010) */

export type Gym = {
  /** Identificador estável: "osm:node/123", "osm:way/456" ou "gymbro:<uuid>" (sugerida) */
  placeId: string;
  nome: string;
  endereco: string;
  lat: number;
  lng: number;
  /** km até o usuário (só na busca por proximidade) */
  distanciaKm?: number;
  /** Quantas pessoas do GymBrô treinam lá */
  usuarios?: number;
  status?: 'aprovada' | 'pendente';
};

export type GymLink = { gym: Gym; tipo: 'principal' | 'secundaria'; desde: string };

export const MAX_SECONDARY = 2;
export const MAIN_CHANGE_DAYS = 7;

/** Distância em km entre dois pontos (fórmula de haversine) */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Texto da distância: "350 m", "1,2 km", "12 km" */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.max(50, Math.round((km * 1000) / 50) * 50)} m`;
  if (km < 10) return `${km.toFixed(1).replace('.', ',')} km`;
  return `${Math.round(km)} km`;
}

/** RN-008: distância entre pessoas é mostrada arredondada para 1 km */
export const roundedPersonDistance = (km: number) => Math.max(1, Math.round(km));

/**
 * RN-009: dias que faltam para poder trocar a academia principal.
 * 0 = pode trocar agora.
 */
export function daysUntilMainChange(desde: Date, now: Date = new Date()): number {
  const elapsed = (now.getTime() - desde.getTime()) / 86_400_000;
  return elapsed >= MAIN_CHANGE_DAYS ? 0 : Math.ceil(MAIN_CHANGE_DAYS - elapsed);
}

export class GymRuleError extends Error {}

export const GYM_MESSAGES = {
  linked: (nome: string) => `Pronto! Agora você aparece para quem treina na ${nome}.`,
  wait: (n: number) =>
    `Você poderá trocar sua academia principal novamente em ${n} ${n === 1 ? 'dia' : 'dias'}.`,
  maxSecondary: 'Você já tem 2 academias secundárias. Remova uma para adicionar outra.',
  alreadyMain: 'Esta já é a sua academia principal.',
  noneNearby: 'Nenhuma academia encontrada por perto.',
} as const;

/**
 * Aplica a regra RN-009 a uma lista de vínculos (usada no modo demonstração;
 * a função SQL definir_academia faz o mesmo no banco).
 */
export function applyLink(
  links: GymLink[],
  gym: Gym,
  tipo: 'principal' | 'secundaria',
  now: Date = new Date(),
): GymLink[] {
  const main = links.find((l) => l.tipo === 'principal');
  const others = links.filter((l) => l.gym.placeId !== gym.placeId);
  const today = now.toISOString();

  if (tipo === 'principal') {
    if (main?.gym.placeId === gym.placeId) throw new GymRuleError(GYM_MESSAGES.alreadyMain);
    if (main) {
      const wait = daysUntilMainChange(new Date(main.desde), now);
      if (wait > 0) throw new GymRuleError(GYM_MESSAGES.wait(wait));
    }
    // A antiga principal sai (a pessoa pode adicioná-la como secundária depois)
    return [{ gym, tipo: 'principal', desde: today }, ...others.filter((l) => l.tipo === 'secundaria')];
  }

  if (main?.gym.placeId === gym.placeId) throw new GymRuleError(GYM_MESSAGES.alreadyMain);
  const secondaries = others.filter((l) => l.tipo === 'secundaria');
  if (secondaries.length >= MAX_SECONDARY) throw new GymRuleError(GYM_MESSAGES.maxSecondary);
  return [...others, { gym, tipo: 'secundaria', desde: today }];
}
