/**
 * Listas mantidas pelo sistema (US-04, notas técnicas).
 * Os mesmos nomes são inseridos no banco por supabase/migrations/0003_perfil_academias.sql.
 */
export const MODALIDADES = [
  'Musculação',
  'Funcional',
  'Crossfit',
  'Cardio',
  'Calistenia',
  'Pilates',
  'Spinning',
  'Lutas',
] as const;

export const OBJETIVOS = [
  'Hipertrofia',
  'Emagrecimento',
  'Condicionamento',
  'Força',
  'Saúde e bem-estar',
  'Definição',
] as const;

export const NIVEIS = [
  { value: 'iniciante', label: 'Iniciante' },
  { value: 'intermediario', label: 'Intermediário' },
  { value: 'avancado', label: 'Avançado' },
] as const;

export const GENEROS = ['Mulher', 'Homem', 'Não binário', 'Prefiro não dizer'] as const;

export const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const; // índice = dia_semana (0 = domingo)

export const PERIODOS = [
  { value: 'manha', label: 'Manhã' },
  { value: 'tarde', label: 'Tarde' },
  { value: 'noite', label: 'Noite' },
] as const;

export const INTERESSES: { categoria: string; nomes: string[] }[] = [
  {
    categoria: 'Esportes',
    nomes: ['Corrida', 'Futebol', 'Ciclismo', 'Natação', 'Vôlei', 'Basquete', 'Trilha'],
  },
  {
    categoria: 'Treino',
    nomes: ['Powerlifting', 'Fisiculturismo', 'Yoga', 'Alongamento', 'HIIT', 'Mobilidade'],
  },
  { categoria: 'Saúde', nomes: ['Nutrição', 'Dieta flexível', 'Suplementação', 'Sono', 'Meditação'] },
  {
    categoria: 'Lifestyle',
    nomes: ['Música', 'Games', 'Séries', 'Viagens', 'Cozinhar', 'Pets', 'Tecnologia'],
  },
];
