-- GymBrô — schema inicial a partir do MER (documentacao/diagramas/mer_completo.png)
-- Rode no Supabase: SQL Editor > New query > cole este arquivo > Run.
--
-- Diferenças em relação ao MER:
--  * usuario.id referencia auth.users (o Supabase Auth guarda e-mail e senha com hash,
--    então senha_hash e email não ficam nesta tabela — RNF-003, RN-003).
--  * localização do usuário NÃO é guardada (RN-008); só academia.latitude/longitude.

create extension if not exists "pgcrypto";

-- ---------- Catálogos ----------
create table modalidade (id uuid primary key default gen_random_uuid(), nome varchar not null unique);
create table objetivo   (id uuid primary key default gen_random_uuid(), nome varchar not null unique);
create table interesse  (id uuid primary key default gen_random_uuid(), nome varchar not null unique, categoria varchar);

create table academia (
  id uuid primary key default gen_random_uuid(),
  nome varchar not null,
  endereco varchar,
  latitude double precision not null,
  longitude double precision not null,
  place_id varchar unique,
  status varchar not null default 'aprovada' check (status in ('aprovada', 'pendente', 'recusada'))
);

-- ---------- Usuário e perfil ----------
create table usuario (
  id uuid primary key references auth.users (id) on delete cascade,
  nome varchar not null,
  data_nascimento date not null check (data_nascimento <= current_date - interval '18 years'), -- RN-004
  genero varchar,
  bio varchar(500), -- RN-007
  nivel varchar check (nivel in ('iniciante', 'intermediario', 'avancado')),
  status varchar not null default 'ativo' check (status in ('ativo', 'suspenso', 'desativado')),
  criado_em timestamptz not null default now()
);

create table foto_perfil (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuario (id) on delete cascade,
  url varchar not null,
  ordem int not null check (ordem between 1 and 6) -- RN-007
);

create table usuario_modalidade (usuario_id uuid references usuario (id) on delete cascade, modalidade_id uuid references modalidade (id), primary key (usuario_id, modalidade_id));
create table usuario_objetivo   (usuario_id uuid references usuario (id) on delete cascade, objetivo_id uuid references objetivo (id), primary key (usuario_id, objetivo_id));
create table usuario_interesse  (usuario_id uuid references usuario (id) on delete cascade, interesse_id uuid references interesse (id), primary key (usuario_id, interesse_id));

create table disponibilidade (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuario (id) on delete cascade,
  dia_semana int not null check (dia_semana between 0 and 6),
  periodo varchar not null check (periodo in ('manha', 'tarde', 'noite'))
);

create table preferencia_descoberta (
  usuario_id uuid primary key references usuario (id) on delete cascade,
  idade_min int not null default 18 check (idade_min >= 18),
  idade_max int not null default 99,
  generos varchar[] not null default '{}',
  distancia_max_km int not null default 5 check (distancia_max_km between 1 and 50), -- RN-010
  somente_minha_academia boolean not null default false,
  visivel boolean not null default true
);

create table usuario_academia (
  usuario_id uuid references usuario (id) on delete cascade,
  academia_id uuid references academia (id),
  tipo varchar not null check (tipo in ('principal', 'secundaria')),
  desde date not null default current_date,
  primary key (usuario_id, academia_id)
);
-- RN-009: exatamente 1 principal (a regra de "até 2 secundárias" e "troca a cada 7 dias" fica numa função)
create unique index um_principal_por_usuario on usuario_academia (usuario_id) where tipo = 'principal';

create table aceite_termos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuario (id) on delete cascade,
  versao varchar not null,
  aceito_em timestamptz not null default now()
);

-- ---------- Descoberta, conexões e chat ----------
create table curtida (
  id uuid primary key default gen_random_uuid(),
  origem_id uuid not null references usuario (id) on delete cascade,
  destino_id uuid not null references usuario (id) on delete cascade,
  tipo varchar not null check (tipo in ('curtir', 'passar')),
  criado_em timestamptz not null default now(),
  unique (origem_id, destino_id)
);

create table conexao (
  id uuid primary key default gen_random_uuid(),
  usuario1_id uuid not null references usuario (id) on delete cascade,
  usuario2_id uuid not null references usuario (id) on delete cascade,
  status varchar not null default 'ativa' check (status in ('ativa', 'desfeita')),
  criado_em timestamptz not null default now(),
  check (usuario1_id < usuario2_id),
  unique (usuario1_id, usuario2_id)
);

create table mensagem (
  id uuid primary key default gen_random_uuid(),
  conexao_id uuid not null references conexao (id) on delete cascade,
  remetente_id uuid not null references usuario (id) on delete cascade,
  conteudo text not null,
  enviada_em timestamptz not null default now(),
  lida_em timestamptz
);

create table bloqueio (
  bloqueador_id uuid references usuario (id) on delete cascade,
  bloqueado_id uuid references usuario (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (bloqueador_id, bloqueado_id)
);

-- ---------- Feed e constância ----------
create table publicacao (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuario (id) on delete cascade,
  academia_id uuid references academia (id),
  modalidade_id uuid references modalidade (id),
  foto_url varchar not null,
  legenda varchar,
  duracao_min int,
  data_referencia date not null default current_date, -- RN-017 (sem retroativo)
  conta_para_sequencia boolean not null default false,
  visibilidade varchar not null default 'academia_conexoes' check (visibilidade in ('academia_conexoes', 'conexoes')), -- RN-021
  excluida_em timestamptz, -- exclusão lógica por 30 dias (US-20)
  criado_em timestamptz not null default now()
);
-- RN-017: só 1 check-in por dia
create unique index um_checkin_por_dia on publicacao (usuario_id, data_referencia)
  where conta_para_sequencia and excluida_em is null;

create table curtida_publicacao (
  usuario_id uuid references usuario (id) on delete cascade,
  publicacao_id uuid references publicacao (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (usuario_id, publicacao_id)
);

create table comentario (
  id uuid primary key default gen_random_uuid(),
  publicacao_id uuid not null references publicacao (id) on delete cascade,
  usuario_id uuid not null references usuario (id) on delete cascade,
  texto varchar(300) not null check (length(trim(texto)) >= 1), -- RN-020
  criado_em timestamptz not null default now()
);

create table estatistica_atividade (
  usuario_id uuid primary key references usuario (id) on delete cascade,
  total_dias_ativos int not null default 0,
  sequencia_atual int not null default 0,
  maior_sequencia int not null default 0,
  ultima_data_ativa date
);

-- ---------- Segurança e notificações ----------
create table denuncia (
  id uuid primary key default gen_random_uuid(),
  denunciante_id uuid not null references usuario (id) on delete cascade,
  denunciado_id uuid references usuario (id) on delete cascade,
  publicacao_id uuid references publicacao (id) on delete set null,
  motivo varchar not null,
  status varchar not null default 'aberta' check (status in ('aberta', 'em_analise', 'resolvida')),
  criado_em timestamptz not null default now()
);

create table notificacao (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuario (id) on delete cascade,
  tipo varchar not null,
  referencia_id uuid,
  lida boolean not null default false,
  criado_em timestamptz not null default now()
);

-- ---------- Row Level Security (RNF-003) ----------
-- Tudo começa fechado. As políticas abaixo são o mínimo para a Sprint 1;
-- cada sprint acrescenta as suas (ver docs/PLANO_DE_DESENVOLVIMENTO.md).
do $$
declare t text;
begin
  foreach t in array array[
    'modalidade','objetivo','interesse','academia','usuario','foto_perfil','usuario_modalidade',
    'usuario_objetivo','usuario_interesse','disponibilidade','preferencia_descoberta','usuario_academia',
    'aceite_termos','curtida','conexao','mensagem','bloqueio','publicacao','curtida_publicacao',
    'comentario','estatistica_atividade','denuncia','notificacao'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- Catálogos: leitura para qualquer usuário logado
create policy "catalogo leitura" on modalidade for select to authenticated using (true);
create policy "catalogo leitura" on objetivo   for select to authenticated using (true);
create policy "catalogo leitura" on interesse  for select to authenticated using (true);
create policy "academias aprovadas" on academia for select to authenticated using (status = 'aprovada');

-- Usuário: cada um lê e altera só o próprio registro (a descoberta usará uma função security definer)
create policy "proprio usuario" on usuario for all to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "proprias fotos" on foto_perfil for all to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy "proprias preferencias" on preferencia_descoberta for all to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy "proprio aceite" on aceite_termos for all to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
