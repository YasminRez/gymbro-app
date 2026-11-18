import { PROFILE_LIMITS } from './rules';

/** Perfil como o app manipula (US-04, US-05) */
export type Periodo = 'manha' | 'tarde' | 'noite';
export type Disponibilidade = { dia: number; periodo: Periodo };
export type Nivel = 'iniciante' | 'intermediario' | 'avancado';

export type Foto = {
  /** Endereço local (recém-escolhida) ou URL pública (já enviada) */
  uri: string;
  /** true quando ainda precisa ser enviada ao Storage */
  local?: boolean;
};

export type ProfileData = {
  fotos: Foto[];
  bio: string;
  genero: string | null;
  modalidades: string[];
  objetivos: string[];
  nivel: Nivel | null;
  disponibilidade: Disponibilidade[];
  interesses: string[];
};

export const emptyProfile: ProfileData = {
  fotos: [],
  bio: '',
  genero: null,
  modalidades: [],
  objetivos: [],
  nivel: null,
  disponibilidade: [],
  interesses: [],
};

export const MAX_PHOTOS_MESSAGE = 'Você pode ter no máximo 6 fotos. Remova uma para adicionar outra.';

/** Itens que faltam em cada etapa (US-04, cenário 5: "indica os itens que faltam") */
export function missingStep1(p: ProfileData): string[] {
  const m: string[] = [];
  if (p.fotos.length < PROFILE_LIMITS.photos.min) m.push('ao menos 1 foto');
  if (!p.bio.trim()) m.push('bio');
  if (p.bio.length > PROFILE_LIMITS.bioMax) m.push('bio com até 500 caracteres');
  if (!p.genero) m.push('gênero');
  return m;
}

export function missingStep2(p: ProfileData): string[] {
  const m: string[] = [];
  if (p.modalidades.length === 0) m.push('modalidade');
  if (p.objetivos.length === 0) m.push('objetivo');
  if (!p.nivel) m.push('nível');
  if (p.disponibilidade.length === 0) m.push('dia e período de treino');
  return m;
}

export function missingStep3(p: ProfileData): string[] {
  const n = p.interesses.length;
  if (n < PROFILE_LIMITS.interests.min) return [`mais ${PROFILE_LIMITS.interests.min - n} interesse(s)`];
  if (n > PROFILE_LIMITS.interests.max) return ['no máximo 10 interesses'];
  return [];
}

export const isProfileValid = (p: ProfileData) =>
  missingStep1(p).length === 0 && missingStep2(p).length === 0 && missingStep3(p).length === 0;

/** RN-006 — o que falta para entrar na descoberta */
export type MissingItem = 'foto' | 'modalidade' | 'objetivo' | 'periodo' | 'academia';

export function missingForDiscovery(p: ProfileData | null, hasMainGym: boolean): MissingItem[] {
  const m: MissingItem[] = [];
  if (!p || p.fotos.length === 0) m.push('foto');
  if (!p || p.modalidades.length === 0) m.push('modalidade');
  if (!p || p.objetivos.length === 0) m.push('objetivo');
  if (!p || p.disponibilidade.length === 0) m.push('periodo');
  if (!hasMainGym) m.push('academia');
  return m;
}

export const MISSING_LABEL: Record<MissingItem, string> = {
  foto: 'Foto de perfil',
  modalidade: 'Modalidade',
  objetivo: 'Objetivo',
  periodo: 'Dias e períodos de treino',
  academia: 'Academia principal',
};

/** Liga/desliga um item numa lista, respeitando um máximo opcional */
export function toggle<T>(list: T[], item: T, max?: number, eq: (a: T, b: T) => boolean = Object.is): T[] {
  const has = list.some((x) => eq(x, item));
  if (has) return list.filter((x) => !eq(x, item));
  if (max !== undefined && list.length >= max) return list;
  return [...list, item];
}

export const sameSlot = (a: Disponibilidade, b: Disponibilidade) =>
  a.dia === b.dia && a.periodo === b.periodo;

/** Move a foto escolhida para a 1ª posição (foto principal) */
export function makeMain(fotos: Foto[], index: number): Foto[] {
  if (index <= 0 || index >= fotos.length) return fotos;
  const copy = [...fotos];
  const [f] = copy.splice(index, 1);
  return [f, ...copy];
}

/** Move a foto uma posição para a esquerda (-1) ou direita (+1) */
export function movePhoto(fotos: Foto[], index: number, dir: -1 | 1): Foto[] {
  const to = index + dir;
  if (to < 0 || to >= fotos.length) return fotos;
  const copy = [...fotos];
  [copy[index], copy[to]] = [copy[to], copy[index]];
  return copy;
}

/** Compara dois perfis para saber se há alterações não salvas (US-05, cenário 4) */
export function profileChanged(a: ProfileData, b: ProfileData): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}
