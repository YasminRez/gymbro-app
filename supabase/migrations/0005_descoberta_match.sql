-- GymBrô — Sprint 3: descoberta de parceiros, curtir/passar e match (US-08, US-09, US-10)
-- Rode depois do 0004_permissoes_funcoes.sql.

-- ------------------------------------------------------------------
-- Auxiliares
-- ------------------------------------------------------------------

-- Distância em km entre dois pontos (haversine)
create or replace function public.distancia_km(lat1 float8, lng1 float8, lat2 float8, lng2 float8)
returns float8
language sql
immutable
as $$
  select 2 * 6371 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

-- Proporção de itens em comum, usando o menor conjunto como base (mesma regra de src/domain/rules.ts)
create or replace function public.proporcao_comum(a text[], b text[])
returns float8
language sql
immutable
as $$
  select case
    when coalesce(cardinality(a), 0) = 0 or coalesce(cardinality(b), 0) = 0 then 0
    else (select count(distinct x) from unnest(a) x where x = any (b))::float8
         / least((select count(distinct x) from unnest(a) x), (select count(distinct y) from unnest(b) y))
  end;
$$;

-- Perfil resumido de um usuário (listas por nome), usado na descoberta e no perfil completo
create or replace view public.perfil_resumo
with (security_invoker = false) as
select
  u.id,
  u.nome,
  u.genero,
  u.bio,
  u.nivel,
  u.status,
  extract(year from age(u.data_nascimento))::int as idade,
  coalesce((select array_agg(f.url order by f.ordem) from foto_perfil f where f.usuario_id = u.id), '{}') as fotos,
  coalesce((select array_agg(m.nome) from usuario_modalidade um join modalidade m on m.id = um.modalidade_id where um.usuario_id = u.id), '{}') as modalidades,
  coalesce((select array_agg(o.nome) from usuario_objetivo uo join objetivo o on o.id = uo.objetivo_id where uo.usuario_id = u.id), '{}') as objetivos,
  coalesce((select array_agg(i.nome) from usuario_interesse ui join interesse i on i.id = ui.interesse_id where ui.usuario_id = u.id), '{}') as interesses,
  coalesce((select array_agg(d.dia_semana || '-' || d.periodo) from disponibilidade d where d.usuario_id = u.id), '{}') as slots,
  (select ua.academia_id from usuario_academia ua where ua.usuario_id = u.id and ua.tipo = 'principal') as academia_principal,
  coalesce((select array_agg(ua.academia_id) from usuario_academia ua where ua.usuario_id = u.id and ua.tipo = 'secundaria'), '{}') as academias_secundarias,
  coalesce(e.total_dias_ativos, 0) as dias_ativos,
  coalesce(e.sequencia_atual, 0) as sequencia_atual
from usuario u
left join estatistica_atividade e on e.usuario_id = u.id;

-- A view expõe dados de outros usuários: só as funções abaixo (security definer) leem
revoke all on public.perfil_resumo from anon, authenticated;

-- ------------------------------------------------------------------
-- US-08 / RN-024: descoberta ordenada por compatibilidade
-- ------------------------------------------------------------------
create or replace function public.buscar_parceiros(
  p_periodo text default null,
  p_modalidade text default null,
  p_objetivo text default null,
  p_limite int default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_eu perfil_resumo;
  v_pref preferencia_descoberta;
  v_minha academia;
  v_resultado jsonb;
begin
  if v_uid is null then raise exception 'NAO_AUTENTICADO'; end if;

  select * into v_eu from perfil_resumo where id = v_uid;
  -- RN-006: sem perfil mínimo, não busca
  if v_eu.academia_principal is null or cardinality(v_eu.fotos) = 0 or cardinality(v_eu.modalidades) = 0
     or cardinality(v_eu.objetivos) = 0 or cardinality(v_eu.slots) = 0 then
    raise exception 'PERFIL_INCOMPLETO';
  end if;

  select * into v_pref from preferencia_descoberta where usuario_id = v_uid;
  select * into v_minha from academia where id = v_eu.academia_principal;

  with candidatos as (
    select p.*, a.nome as academia_nome, a.latitude, a.longitude,
      case when v_minha.latitude = 0 and v_minha.longitude = 0 then null
           else distancia_km(v_minha.latitude, v_minha.longitude, a.latitude, a.longitude) end as dist
    from perfil_resumo p
    join academia a on a.id = p.academia_principal
    left join preferencia_descoberta pp on pp.usuario_id = p.id
    where p.id <> v_uid
      and p.status = 'ativo'
      and coalesce(pp.visivel, true)
      -- RN-006 do outro lado
      and cardinality(p.fotos) > 0 and cardinality(p.modalidades) > 0
      and cardinality(p.objetivos) > 0 and cardinality(p.slots) > 0
      -- RN-015: bloqueio nos dois sentidos
      and not exists (select 1 from bloqueio b where (b.bloqueador_id = v_uid and b.bloqueado_id = p.id)
                                                  or (b.bloqueador_id = p.id and b.bloqueado_id = v_uid))
      -- já conectados
      and not exists (select 1 from conexao c where c.status = 'ativa'
                        and c.usuario1_id = least(v_uid, p.id) and c.usuario2_id = greatest(v_uid, p.id))
      -- já curtiu (sempre) ou passou há menos de 30 dias (RN-013)
      and not exists (select 1 from curtida ct where ct.origem_id = v_uid and ct.destino_id = p.id
                        and (ct.tipo = 'curtir' or ct.criado_em > now() - interval '30 days'))
      -- preferências (US-05)
      and p.idade between coalesce(v_pref.idade_min, 18) and coalesce(v_pref.idade_max, 99)
      and (coalesce(cardinality(v_pref.generos), 0) = 0 or p.genero = any (v_pref.generos))
      -- filtros rápidos (US-08, cenário 2)
      and (p_periodo is null or exists (select 1 from unnest(p.slots) s where s like '%-' || p_periodo))
      and (p_modalidade is null or p_modalidade = any (p.modalidades))
      and (p_objetivo is null or p_objetivo = any (p.objetivos))
  ),
  filtrados as (
    select c.* from candidatos c
    where case
      when coalesce(v_pref.somente_minha_academia, false) then
        c.academia_principal = v_eu.academia_principal
        or c.academia_principal = any (v_eu.academias_secundarias)
        or v_eu.academia_principal = any (c.academias_secundarias)
      else
        c.academia_principal = v_eu.academia_principal
        or c.dist is null
        or c.dist <= coalesce(v_pref.distancia_max_km, 5)
      end
  ),
  pontuados as (
    select f.*,
      round(least(100,
        case
          when f.academia_principal = v_eu.academia_principal then 40
          when f.academia_principal = any (v_eu.academias_secundarias)
            or v_eu.academia_principal = any (f.academias_secundarias) then 20
          else 0
        end
        + 25 * proporcao_comum(f.slots, v_eu.slots)
        + 15 * proporcao_comum(f.objetivos, v_eu.objetivos)
        + 10 * proporcao_comum(f.modalidades, v_eu.modalidades)
        + 10 * proporcao_comum(f.interesses, v_eu.interesses)
      ))::int as compatibilidade
    from filtrados f
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id,
      'nome', p.nome,
      'idade', p.idade,
      'genero', p.genero,
      'bio', p.bio,
      'nivel', p.nivel,
      'fotos', to_jsonb(p.fotos),
      'academia', p.academia_nome,
      -- RN-008: só distância aproximada (1 km), nunca a localização
      'distanciaKm', case when p.dist is null then null else greatest(1, round(p.dist))::int end,
      'slots', to_jsonb(p.slots),
      'modalidades', to_jsonb(p.modalidades),
      'objetivos', to_jsonb(p.objetivos),
      'interesses', to_jsonb(p.interesses),
      'interessesComuns', to_jsonb(array(select x from unnest(p.interesses) x where x = any (v_eu.interesses))),
      'diasAtivos', p.dias_ativos,
      'sequencia', p.sequencia_atual,
      'compatibilidade', p.compatibilidade
    ) order by p.compatibilidade desc, p.dias_ativos desc), '[]'::jsonb)
  into v_resultado
  from (select * from pontuados order by compatibilidade desc limit greatest(1, least(p_limite, 100))) p;

  return v_resultado;
end;
$$;

-- ------------------------------------------------------------------
-- US-09 / US-10 / RN-011 / RN-012: curtir ou passar, com match transacional
-- Retorna { "match": bool, "conexaoId": uuid|null, "curtidasHoje": int }
-- ------------------------------------------------------------------
create or replace function public.registrar_acao(p_destino uuid, p_tipo text, p_fuso text default 'America/Sao_Paulo')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_hoje int;
  v_conexao uuid;
  v_nome text;
begin
  if v_uid is null then raise exception 'NAO_AUTENTICADO'; end if;
  if p_tipo not in ('curtir', 'passar') then raise exception 'TIPO_INVALIDO'; end if;
  if p_destino = v_uid then raise exception 'ACAO_INVALIDA'; end if;
  if exists (select 1 from bloqueio b where (b.bloqueador_id = v_uid and b.bloqueado_id = p_destino)
                                         or (b.bloqueador_id = p_destino and b.bloqueado_id = v_uid)) then
    raise exception 'ACAO_INVALIDA';
  end if;

  -- RN-012: 100 curtidas por dia, zerando à meia-noite no fuso do usuário
  select count(*) into v_hoje from curtida
   where origem_id = v_uid and tipo = 'curtir'
     and (criado_em at time zone p_fuso)::date = (now() at time zone p_fuso)::date;
  if p_tipo = 'curtir' and v_hoje >= 100 then raise exception 'LIMITE_CURTIDAS'; end if;

  insert into curtida (origem_id, destino_id, tipo)
  values (v_uid, p_destino, p_tipo)
  on conflict (origem_id, destino_id) do update set tipo = excluded.tipo, criado_em = now();

  -- RN-011: conexão só com curtida mútua. least/greatest + unique evitam duplicadas.
  if p_tipo = 'curtir' and exists (
    select 1 from curtida where origem_id = p_destino and destino_id = v_uid and tipo = 'curtir'
  ) then
    insert into conexao (usuario1_id, usuario2_id)
    values (least(v_uid, p_destino), greatest(v_uid, p_destino))
    on conflict (usuario1_id, usuario2_id) do update set status = 'ativa'
    returning id into v_conexao;

    -- US-10, cenário 2: aviso para a outra pessoa (o push entra na Sprint 6)
    select nome into v_nome from usuario where id = v_uid;
    insert into notificacao (usuario_id, tipo, referencia_id) values (p_destino, 'conexao', v_conexao);
  end if;

  return jsonb_build_object(
    'match', v_conexao is not null,
    'conexaoId', v_conexao,
    'curtidasHoje', v_hoje + (case when p_tipo = 'curtir' then 1 else 0 end)
  );
end;
$$;

-- US-09, cenário 3: desfazer a última ação (se ainda não virou conexão)
create or replace function public.desfazer_acao(p_destino uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'NAO_AUTENTICADO'; end if;
  delete from curtida c
   where c.origem_id = auth.uid() and c.destino_id = p_destino
     and c.criado_em > now() - interval '10 minutes'
     and not exists (select 1 from conexao x where x.status = 'ativa'
                       and x.usuario1_id = least(auth.uid(), p_destino)
                       and x.usuario2_id = greatest(auth.uid(), p_destino));
end;
$$;

-- Quantas curtidas já foram usadas hoje (RN-012)
create or replace function public.curtidas_hoje(p_fuso text default 'America/Sao_Paulo')
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from curtida
   where origem_id = auth.uid() and tipo = 'curtir'
     and (criado_em at time zone p_fuso)::date = (now() at time zone p_fuso)::date;
$$;

-- US-08, cenário 3: perfil completo de outra pessoa (respeitando bloqueios)
create or replace function public.perfil_publico(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', p.id, 'nome', p.nome, 'idade', p.idade, 'genero', p.genero, 'bio', p.bio, 'nivel', p.nivel,
    'fotos', to_jsonb(p.fotos), 'academia', a.nome, 'slots', to_jsonb(p.slots),
    'modalidades', to_jsonb(p.modalidades), 'objetivos', to_jsonb(p.objetivos),
    'interesses', to_jsonb(p.interesses),
    'interessesComuns', to_jsonb(array(select x from unnest(p.interesses) x
                                       where x in (select unnest(r.interesses) from perfil_resumo r where r.id = auth.uid()))),
    'diasAtivos', p.dias_ativos, 'sequencia', p.sequencia_atual
  )
  from perfil_resumo p
  left join academia a on a.id = p.academia_principal
  where p.id = p_id and auth.uid() is not null and p.status = 'ativo'
    and not exists (select 1 from bloqueio b where (b.bloqueador_id = auth.uid() and b.bloqueado_id = p.id)
                                                or (b.bloqueador_id = p.id and b.bloqueado_id = auth.uid()));
$$;

-- Leitura das próprias conexões e notificações (usadas na tela de match e na Sprint 4)
create policy "proprias conexoes" on conexao for select to authenticated
  using (auth.uid() in (usuario1_id, usuario2_id));
create policy "proprias notificacoes" on notificacao for select to authenticated
  using (usuario_id = auth.uid());
create policy "marcar notificacao lida" on notificacao for update to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Permissões: só usuários logados
revoke execute on function public.buscar_parceiros(text, text, text, int) from public, anon;
revoke execute on function public.registrar_acao(uuid, text, text) from public, anon;
revoke execute on function public.desfazer_acao(uuid) from public, anon;
revoke execute on function public.curtidas_hoje(text) from public, anon;
revoke execute on function public.perfil_publico(uuid) from public, anon;
grant execute on function public.buscar_parceiros(text, text, text, int) to authenticated;
grant execute on function public.registrar_acao(uuid, text, text) to authenticated;
grant execute on function public.desfazer_acao(uuid) to authenticated;
grant execute on function public.curtidas_hoje(text) to authenticated;
grant execute on function public.perfil_publico(uuid) to authenticated;

-- Índices para a descoberta
create index if not exists curtida_destino_idx on curtida (destino_id, origem_id);
create index if not exists usuario_academia_academia_idx on usuario_academia (academia_id);
