import {
  ActionResult,
  Candidate,
  DISCOVERY_MESSAGES,
  DiscoveryError,
  DiscoveryFilters,
} from '@/domain/discovery';
import { compatibility, CompatProfile, DAILY_LIKE_LIMIT } from '@/domain/rules';
import { ProfileData } from '@/domain/profile';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

/**
 * Descoberta, curtir/passar e match (US-08, US-09, US-10).
 * No Supabase, a lista e o match são calculados no banco (funções buscar_parceiros e
 * registrar_acao, migration 0005). No modo demonstração, com perfis de exemplo.
 */

type DiscoveryApi = {
  fetch(filters: DiscoveryFilters): Promise<Candidate[]>;
  act(id: string, tipo: 'curtir' | 'passar'): Promise<ActionResult>;
  undo(id: string): Promise<void>;
  likesToday(): Promise<number>;
  profile(id: string): Promise<Candidate | null>;
};

const fuso = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';

function mapError(message: string): DiscoveryError {
  if (message.includes('LIMITE_CURTIDAS')) return new DiscoveryError(DISCOVERY_MESSAGES.likeLimit);
  if (message.includes('PERFIL_INCOMPLETO')) return new DiscoveryError(DISCOVERY_MESSAGES.incomplete);
  return new DiscoveryError(DISCOVERY_MESSAGES.generic);
}

const supabaseApi: DiscoveryApi = {
  async fetch(f) {
    const { data, error } = await supabase.rpc('buscar_parceiros', {
      p_periodo: f.periodo,
      p_modalidade: f.modalidade,
      p_objetivo: f.objetivo,
      p_limite: 30,
    });
    if (error) throw mapError(error.message);
    return (data ?? []) as Candidate[];
  },
  async act(id, tipo) {
    const { data, error } = await supabase.rpc('registrar_acao', {
      p_destino: id,
      p_tipo: tipo,
      p_fuso: fuso(),
    });
    if (error) throw mapError(error.message);
    return data as ActionResult;
  },
  async undo(id) {
    await supabase.rpc('desfazer_acao', { p_destino: id });
  },
  async likesToday() {
    const { data } = await supabase.rpc('curtidas_hoje', { p_fuso: fuso() });
    return (data as number) ?? 0;
  },
  async profile(id) {
    const { data, error } = await supabase.rpc('perfil_publico', { p_id: id });
    if (error || !data) return null;
    return data as Candidate;
  },
};

/* ------------------------------------------------------------------ */
/* Modo demonstração: perfis de exemplo, mesma regra de compatibilidade */
/* ------------------------------------------------------------------ */

type DemoPerson = Omit<Candidate, 'compatibilidade' | 'interessesComuns' | 'distanciaKm'> & {
  mesmaAcademia: boolean;
  distancia: number;
  /** Já curtiu você (gera match ao curtir de volta) */
  curtiuVoce: boolean;
};

const PESSOAS: DemoPerson[] = [
  {
    id: 'demo-ana',
    nome: 'Ana Souza',
    idade: 24,
    genero: 'Mulher',
    nivel: 'intermediario',
    bio: 'Treino de perna toda segunda e quinta à noite. Procuro alguém pra dividir o agachamento pesado.',
    fotos: [],
    academia: 'Sua academia',
    mesmaAcademia: true,
    distancia: 0,
    slots: ['1-noite', '3-noite', '4-noite'],
    modalidades: ['Musculação'],
    objetivos: ['Hipertrofia', 'Força'],
    interesses: ['Corrida', 'Nutrição', 'Música', 'Séries'],
    diasAtivos: 41,
    sequencia: 9,
    curtiuVoce: true,
  },
  {
    id: 'demo-bruno',
    nome: 'Bruno Lima',
    idade: 29,
    genero: 'Homem',
    nivel: 'avancado',
    bio: 'Powerlifting há 5 anos. Posso ajudar com técnica de supino e terra.',
    fotos: [],
    academia: 'Sua academia',
    mesmaAcademia: true,
    distancia: 0,
    slots: ['1-manha', '3-manha', '5-manha'],
    modalidades: ['Musculação'],
    objetivos: ['Força'],
    interesses: ['Powerlifting', 'Suplementação', 'Games'],
    diasAtivos: 120,
    sequencia: 22,
    curtiuVoce: false,
  },
  {
    id: 'demo-carla',
    nome: 'Carla Mendes',
    idade: 31,
    genero: 'Mulher',
    nivel: 'iniciante',
    bio: 'Voltando a treinar depois de um tempo parada. Bora manter a constância juntas!',
    fotos: [],
    academia: 'Academia do bairro',
    mesmaAcademia: false,
    distancia: 3,
    slots: ['2-noite', '4-noite'],
    modalidades: ['Funcional', 'Cardio'],
    objetivos: ['Emagrecimento', 'Condicionamento'],
    interesses: ['Yoga', 'Cozinhar', 'Pets', 'Música'],
    diasAtivos: 6,
    sequencia: 3,
    curtiuVoce: false,
  },
  {
    id: 'demo-diego',
    nome: 'Diego Rocha',
    idade: 22,
    genero: 'Homem',
    nivel: 'intermediario',
    bio: 'Crossfit e calistenia. Sempre no fim da tarde.',
    fotos: [],
    academia: 'Box Central',
    mesmaAcademia: false,
    distancia: 4,
    slots: ['1-tarde', '2-tarde', '3-tarde', '4-tarde'],
    modalidades: ['Crossfit', 'Calistenia'],
    objetivos: ['Condicionamento'],
    interesses: ['HIIT', 'Futebol', 'Corrida'],
    diasAtivos: 58,
    sequencia: 12,
    curtiuVoce: true,
  },
  {
    id: 'demo-eva',
    nome: 'Eva Martins',
    idade: 27,
    genero: 'Mulher',
    nivel: 'avancado',
    bio: 'Fisiculturismo natural. Foco total em hipertrofia.',
    fotos: [],
    academia: 'Sua academia',
    mesmaAcademia: true,
    distancia: 0,
    slots: ['1-noite', '2-noite', '3-noite', '4-noite', '5-noite'],
    modalidades: ['Musculação'],
    objetivos: ['Hipertrofia', 'Definição'],
    interesses: ['Fisiculturismo', 'Dieta flexível', 'Sono'],
    diasAtivos: 210,
    sequencia: 45,
    curtiuVoce: false,
  },
  {
    id: 'demo-felipe',
    nome: 'Felipe Araújo',
    idade: 35,
    genero: 'Homem',
    nivel: 'iniciante',
    bio: 'Comecei agora, quero alguém pra me cobrar presença.',
    fotos: [],
    academia: 'Sua academia',
    mesmaAcademia: true,
    distancia: 0,
    slots: ['6-manha', '0-manha'],
    modalidades: ['Musculação', 'Cardio'],
    objetivos: ['Saúde e bem-estar'],
    interesses: ['Ciclismo', 'Viagens', 'Tecnologia'],
    diasAtivos: 4,
    sequencia: 2,
    curtiuVoce: false,
  },
];

const demo = {
  me: null as (CompatProfile & { interesses: string[] }) | null,
  actions: new Map<string, 'curtir' | 'passar'>(),
  likesToday: 0,
};

/** Chamado pela tela com o perfil do usuário, para calcular a compatibilidade no modo demonstração */
export function setDemoProfile(p: ProfileData | null) {
  if (!p) return;
  demo.me = {
    mainGymId: 'minha',
    secondaryGymIds: [],
    slots: p.disponibilidade.map((d) => ({ day: d.dia, period: d.periodo })),
    goals: p.objetivos,
    modalities: p.modalidades,
    interests: p.interesses,
    interesses: p.interesses,
  };
}

function toCandidate(p: DemoPerson): Candidate {
  const me = demo.me;
  const other: CompatProfile = {
    mainGymId: p.mesmaAcademia ? 'minha' : p.id,
    secondaryGymIds: [],
    slots: p.slots.map((s) => {
      const [d, per] = s.split('-');
      return { day: Number(d), period: per as 'manha' | 'tarde' | 'noite' };
    }),
    goals: p.objetivos,
    modalities: p.modalidades,
    interests: p.interesses,
  };
  return {
    ...p,
    distanciaKm: p.mesmaAcademia ? null : p.distancia,
    interessesComuns: me ? p.interesses.filter((i) => me.interesses.includes(i)) : [],
    compatibilidade: me ? compatibility(me, other) : undefined,
  };
}

const wait = () => new Promise((r) => setTimeout(r, 350));

const demoApi: DiscoveryApi = {
  async fetch(f) {
    await wait();
    return PESSOAS.filter((p) => !demo.actions.has(p.id))
      .filter((p) => !f.periodo || p.slots.some((s) => s.endsWith(`-${f.periodo}`)))
      .filter((p) => !f.modalidade || p.modalidades.includes(f.modalidade))
      .filter((p) => !f.objetivo || p.objetivos.includes(f.objetivo))
      .map(toCandidate)
      .sort((a, b) => (b.compatibilidade ?? 0) - (a.compatibilidade ?? 0));
  },
  async act(id, tipo) {
    if (tipo === 'curtir' && demo.likesToday >= DAILY_LIKE_LIMIT) {
      throw new DiscoveryError(DISCOVERY_MESSAGES.likeLimit);
    }
    demo.actions.set(id, tipo);
    if (tipo === 'curtir') demo.likesToday += 1;
    const person = PESSOAS.find((p) => p.id === id);
    const match = tipo === 'curtir' && !!person?.curtiuVoce;
    return { match, conexaoId: match ? `demo-conexao-${id}` : null, curtidasHoje: demo.likesToday };
  },
  async undo(id) {
    if (demo.actions.get(id) === 'curtir') demo.likesToday = Math.max(0, demo.likesToday - 1);
    demo.actions.delete(id);
  },
  async likesToday() {
    return demo.likesToday;
  },
  async profile(id) {
    const p = PESSOAS.find((x) => x.id === id);
    return p ? toCandidate(p) : null;
  },
};

export const discoveryApi: DiscoveryApi = isSupabaseConfigured ? supabaseApi : demoApi;

/** Modo demonstração: dados básicos de uma pessoa de exemplo (usado pelo chat) */
export function demoPersonById(id: string): { id: string; nome: string; fotos: string[] } | null {
  const p = PESSOAS.find((x) => x.id === id);
  return p ? { id: p.id, nome: p.nome, fotos: p.fotos } : null;
}
