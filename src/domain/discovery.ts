/** Descoberta de parceiros (US-08, US-09, US-10) */
import { DIAS, PERIODOS } from '@/constants/catalogos';

export type Candidate = {
  id: string;
  nome: string;
  idade: number;
  genero: string | null;
  bio: string | null;
  nivel: string | null;
  fotos: string[];
  academia: string | null;
  /** Distância aproximada entre as academias, já arredondada para 1 km (RN-008) */
  distanciaKm: number | null;
  /** "dia-periodo", ex.: "1-noite" (segunda à noite) */
  slots: string[];
  modalidades: string[];
  objetivos: string[];
  interesses: string[];
  interessesComuns: string[];
  diasAtivos: number;
  sequencia: number;
  compatibilidade?: number;
  /** Só no perfil completo: id da conexão ativa com essa pessoa (se houver) */
  conexaoId?: string | null;
};

export type DiscoveryFilters = {
  periodo: 'manha' | 'tarde' | 'noite' | null;
  modalidade: string | null;
  objetivo: string | null;
};

export const emptyFilters: DiscoveryFilters = { periodo: null, modalidade: null, objetivo: null };

export const hasFilters = (f: DiscoveryFilters) => !!(f.periodo || f.modalidade || f.objetivo);

export type ActionResult = { match: boolean; conexaoId: string | null; curtidasHoje: number };

export class DiscoveryError extends Error {}

export const DISCOVERY_MESSAGES = {
  empty: 'Você já viu todo mundo por aqui. Que tal ampliar seus filtros?',
  likeLimit: 'Você atingiu o limite de curtidas de hoje. Volte amanhã!',
  incomplete: 'Complete seu perfil e escolha sua academia para ver parceiros.',
  generic: 'Não foi possível carregar agora. Verifique sua internet e tente de novo.',
} as const;

/**
 * Resume os horários: "Seg, Qua e Sex · Noite" ou, se variar, "Seg manhã, Qua noite…".
 * Dias em ordem de segunda a domingo.
 */
export function formatSchedule(slots: string[]): string {
  if (slots.length === 0) return 'Horários não informados';
  const parsed = slots
    .map((s) => {
      const [d, p] = s.split('-');
      return { dia: Number(d), periodo: p };
    })
    .filter((s) => !Number.isNaN(s.dia));
  const order = (d: number) => (d === 0 ? 7 : d); // domingo por último
  const periodLabel = (p: string) => PERIODOS.find((x) => x.value === p)?.label ?? p;

  const periods = [...new Set(parsed.map((s) => s.periodo))];
  const days = [...new Set(parsed.map((s) => s.dia))].sort((a, b) => order(a) - order(b));
  const dayList = (ds: number[]) =>
    ds.length === 7
      ? 'Todos os dias'
      : ds.length > 1
        ? `${ds
            .slice(0, -1)
            .map((d) => DIAS[d])
            .join(', ')} e ${DIAS[ds[ds.length - 1]]}`
        : DIAS[ds[0]];

  // Todos os dias com o mesmo conjunto de períodos → formato curto
  const samePeriods = days.every(
    (d) =>
      parsed
        .filter((s) => s.dia === d)
        .map((s) => s.periodo)
        .sort()
        .join() === [...periods].sort().join(),
  );
  if (samePeriods) {
    const ps = PERIODOS.filter((p) => periods.includes(p.value)).map((p) => p.label.toLowerCase());
    return `${dayList(days)} · ${ps.join(' e ').replace(/^./, (c) => c.toUpperCase())}`;
  }
  return days
    .map((d) => {
      const ps = PERIODOS.filter((p) => parsed.some((s) => s.dia === d && s.periodo === p.value)).map((p) =>
        periodLabel(p.value).toLowerCase(),
      );
      return `${DIAS[d]} ${ps.join('/')}`;
    })
    .join(', ');
}

/** Iniciais para o avatar quando não há foto */
export const initials = (nome: string) =>
  nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
