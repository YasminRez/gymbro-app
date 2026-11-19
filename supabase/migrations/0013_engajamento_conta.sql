-- =====================================================================
-- GymBrô · Sprint 6 — Engajamento, conta e acabamento
-- US-21 Notificações (F7, C2) · US-22 Ranking semanal (F8)
-- US-23 Privacidade (RN-008, RN-021) · US-24 Excluir conta (RN-022, RNF-002)
--
-- • Preferências de notificação por tipo: um trigger descarta a notificação
--   desligada antes de gravar (vale para todas as funções que já inserem).
-- • Mensagem nova gera notificação (uma por conversa enquanto não for lida).
-- • Push: o app grava o token do Expo; um trigger chama o Expo Push Service
--   com pg_net (precisa de development build para chegar no celular).
-- • Lembrete de sequência: cron de hora em hora, às 20h no fuso de cada um.
-- • Ranking: check-ins válidos de segunda a domingo na academia principal.
-- • Exclusão: conta desativada na hora e apagada de vez após 30 dias (cron).
-- =====================================================================

create extension if not exists pg_net;

-- ---------- Colunas novas ----------
alter table usuario add column if not exists mostrar_distancia boolean not null default true;   -- RN-008
alter table usuario add column if not exists visibilidade_padrao varchar not null default 'academia_conexoes'
  check (visibilidade_padrao in ('academia_conexoes', 'conexoes'));                             -- RN-021
alter table usuario add column if not exists exclusao_solicitada_em timestamptz;                -- RN-022

create table if not exists preferencia_notificacao (
  usuario_id uuid primary key references usuario (id) on delete cascade,
  matches boolean not null default true,
  mensagens boolean not null default true,
  curtidas boolean not null default true,
  comentarios boolean not null default true,
  convites boolean not null default true,
  lembrete_sequencia boolean not null default true,
  push_token varchar,
  atualizado_em timestamptz not null default now()
);
alter table preferencia_notificacao enable row level security;

-- ---------- Tipo de notificação → preferência ----------
create or replace function public.notificacao_categoria(p_tipo text)
returns text language sql immutable as $$
  select case
    when p_tipo = 'conexao' then 'matches'
    when p_tipo = 'mensagem' then 'mensagens'
    when p_tipo = 'curtida' then 'curtidas'
    when p_tipo = 'comentario' then 'comentarios'
    when p_tipo like 'convite%' then 'convites'
    when p_tipo = 'lembrete_sequencia' then 'lembrete_sequencia'
    else null end;
$$;

-- Descarta a notificação se o tipo estiver desligado (US-21, C2)
create or replace function public.filtrar_notificacao()
returns trigger language plpgsql security definer set search_path = public as $$
declare p preferencia_notificacao; v_ok boolean := true;
begin
  select * into p from preferencia_notificacao where usuario_id = new.usuario_id;
  if p.usuario_id is not null then
    v_ok := case public.notificacao_categoria(new.tipo)
      when 'matches' then p.matches
      when 'mensagens' then p.mensagens
      when 'curtidas' then p.curtidas
      when 'comentarios' then p.comentarios
      when 'convites' then p.convites
      when 'lembrete_sequencia' then p.lembrete_sequencia
      else true end;
  end if;
  -- Conta em exclusão não recebe nada
  if exists (select 1 from usuario where id = new.usuario_id and status <> 'ativo') then v_ok := false; end if;
  if not v_ok then return null; end if;
  return new;
end;
$$;
drop trigger if exists filtrar_notificacao on notificacao;
create trigger filtrar_notificacao before insert on notificacao
  for each row execute function public.filtrar_notificacao();

-- Texto da notificação (usado no push e na lista)
create or replace function public.notificacao_texto(p_tipo text, p_nome text)
returns text language sql immutable as $$
  select case p_tipo
    when 'conexao' then 'Vocês deram match! Mande um oi para ' || coalesce(p_nome, 'seu novo parceiro') || '.'
    when 'mensagem' then coalesce(p_nome, 'Alguém') || ' enviou uma mensagem.'
    when 'curtida' then coalesce(p_nome, 'Alguém') || ' curtiu seu treino.'
    when 'comentario' then coalesce(p_nome, 'Alguém') || ' comentou no seu treino.'
    when 'convite' then coalesce(p_nome, 'Alguém') || ' te convidou para treinar.'
    when 'convite_aceito' then coalesce(p_nome, 'Alguém') || ' aceitou seu convite para treinar.'
    when 'convite_cancelado' then coalesce(p_nome, 'Alguém') || ' cancelou o treino combinado.'
    when 'lembrete_sequencia' then 'Não perca sua sequência! Publique o treino de hoje.'
    else 'Você tem uma novidade no GymBrô.' end;
$$;

-- Push pelo Expo Push Service (só se houver token)
create or replace function public.enviar_push()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_token text; v_nome text;
begin
  select push_token into v_token from preferencia_notificacao where usuario_id = new.usuario_id;
  if v_token is null or v_token = '' then return new; end if;
  select nome into v_nome from usuario where id = new.origem_id;
  begin
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb,
      body := jsonb_build_object(
        'to', v_token,
        'title', 'GymBrô',
        'body', public.notificacao_texto(new.tipo, split_part(coalesce(v_nome, ''), ' ', 1)),
        'sound', 'default',
        'data', jsonb_build_object('tipo', new.tipo, 'referenciaId', new.referencia_id, 'notificacaoId', new.id)
      )
    );
  exception when others then
    null; -- push é melhor-esforço: nunca impede a notificação no app
  end;
  return new;
end;
$$;
drop trigger if exists enviar_push on notificacao;
create trigger enviar_push after insert on notificacao
  for each row execute function public.enviar_push();

-- Mensagem nova → notificação (uma por conversa enquanto houver uma não lida)
create or replace function public.notificar_mensagem()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_dest uuid;
begin
  select case when c.usuario1_id = new.remetente_id then c.usuario2_id else c.usuario1_id end
    into v_dest from conexao c where c.id = new.conexao_id;
  if v_dest is null then return new; end if;
  if not exists (select 1 from notificacao n
                  where n.usuario_id = v_dest and n.tipo = 'mensagem'
                    and n.referencia_id = new.conexao_id and not n.lida) then
    insert into notificacao (usuario_id, tipo, referencia_id, origem_id)
    values (v_dest, 'mensagem', new.conexao_id, new.remetente_id);
  end if;
  return new;
end;
$$;
drop trigger if exists notificar_mensagem on mensagem;
create trigger notificar_mensagem after insert on mensagem
  for each row execute function public.notificar_mensagem();

-- ---------- US-21: lista de notificações (F7) ----------
create or replace function public.listar_notificacoes(p_antes timestamptz default null, p_limite int default 30)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x.j order by x.criado_em desc), '[]'::jsonb)
  from (
    select n.criado_em, jsonb_build_object(
      'id', n.id,
      'tipo', n.tipo,
      'referenciaId', n.referencia_id,
      'lida', n.lida,
      'criadoEm', n.criado_em,
      'texto', public.notificacao_texto(n.tipo, split_part(coalesce(u.nome, ''), ' ', 1)),
      'origem', case when u.id is null then null else jsonb_build_object(
        'id', u.id, 'nome', u.nome,
        'foto', (select f.url from foto_perfil f where f.usuario_id = u.id order by f.ordem limit 1)) end,
      -- para abrir a conversa a partir de convite/mensagem/match
      'conexaoId', case
        when n.tipo in ('conexao', 'mensagem') then n.referencia_id
        when n.tipo like 'convite%' then (select ct.conexao_id from convite_treino ct where ct.id = n.referencia_id)
        else null end
    ) as j
    from notificacao n
    left join usuario u on u.id = n.origem_id
    where n.usuario_id = auth.uid()
      and (p_antes is null or n.criado_em < p_antes)
      and (n.origem_id is null or (u.status = 'ativo' and not public.bloqueados_entre(auth.uid(), n.origem_id)))
    order by n.criado_em desc
    limit least(greatest(coalesce(p_limite, 30), 1), 100)
  ) x;
$$;

create or replace function public.contar_notificacoes_nao_lidas()
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from notificacao n left join usuario u on u.id = n.origem_id
   where n.usuario_id = auth.uid() and not n.lida
     and (n.origem_id is null or (u.status = 'ativo' and not public.bloqueados_entre(auth.uid(), n.origem_id)));
$$;

-- p_ids nulo = marcar todas
create or replace function public.marcar_notificacoes_lidas(p_ids uuid[] default null)
returns void language sql security definer set search_path = public as $$
  update notificacao set lida = true
   where usuario_id = auth.uid() and not lida and (p_ids is null or id = any (p_ids));
$$;

-- ---------- US-21: preferências (C2) ----------
create or replace function public.minhas_preferencias_notificacao()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'matches', coalesce(p.matches, true), 'mensagens', coalesce(p.mensagens, true),
    'curtidas', coalesce(p.curtidas, true), 'comentarios', coalesce(p.comentarios, true),
    'convites', coalesce(p.convites, true), 'lembreteSequencia', coalesce(p.lembrete_sequencia, true))
  from (select auth.uid() as uid) me
  left join preferencia_notificacao p on p.usuario_id = me.uid
  where me.uid is not null;
$$;

create or replace function public.salvar_preferencias_notificacao(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'SEM_SESSAO'; end if;
  insert into preferencia_notificacao (usuario_id, matches, mensagens, curtidas, comentarios, convites, lembrete_sequencia)
  values (auth.uid(),
          coalesce((p->>'matches')::boolean, true), coalesce((p->>'mensagens')::boolean, true),
          coalesce((p->>'curtidas')::boolean, true), coalesce((p->>'comentarios')::boolean, true),
          coalesce((p->>'convites')::boolean, true), coalesce((p->>'lembreteSequencia')::boolean, true))
  on conflict (usuario_id) do update set
    matches = excluded.matches, mensagens = excluded.mensagens, curtidas = excluded.curtidas,
    comentarios = excluded.comentarios, convites = excluded.convites,
    lembrete_sequencia = excluded.lembrete_sequencia, atualizado_em = now();
  return public.minhas_preferencias_notificacao();
end;
$$;

create or replace function public.registrar_push_token(p_token text)
returns void language sql security definer set search_path = public as $$
  insert into preferencia_notificacao (usuario_id, push_token) values (auth.uid(), nullif(btrim(p_token), ''))
  on conflict (usuario_id) do update set push_token = excluded.push_token, atualizado_em = now();
$$;

-- ---------- US-21: lembrete de sequência (20h no fuso do usuário) ----------
create or replace function public.enviar_lembretes_sequencia()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into notificacao (usuario_id, tipo)
  select u.id, 'lembrete_sequencia'
    from usuario u
    join estatistica_atividade e on e.usuario_id = u.id
   where u.status = 'ativo'
     and e.sequencia_atual > 0
     and extract(hour from now() at time zone u.fuso) = 20
     and not exists (select 1 from publicacao p
                      where p.usuario_id = u.id and p.conta_para_sequencia and p.excluida_em is null
                        and p.data_referencia = (now() at time zone u.fuso)::date)
     and not exists (select 1 from notificacao x
                      where x.usuario_id = u.id and x.tipo = 'lembrete_sequencia'
                        and x.criado_em > now() - interval '20 hours');
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ---------- US-22: ranking semanal da academia (F8) ----------
create or replace function public.ranking_semanal(p_academia uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_fuso text;
  v_hoje date;
  v_ini date;
  v_gym uuid;
  v_lista jsonb;
  v_eu jsonb;
begin
  if v_uid is null then raise exception 'SEM_SESSAO'; end if;
  select coalesce(fuso, 'America/Sao_Paulo') into v_fuso from usuario where id = v_uid;
  v_hoje := (now() at time zone v_fuso)::date;
  v_ini := date_trunc('week', v_hoje)::date; -- segunda-feira

  v_gym := coalesce(p_academia,
                    (select academia_id from usuario_academia where usuario_id = v_uid and tipo = 'principal'));
  -- Só academias às quais o usuário está vinculado
  if v_gym is null or not exists (select 1 from usuario_academia where usuario_id = v_uid and academia_id = v_gym) then
    return jsonb_build_object('academia', null, 'inicio', v_ini, 'fim', v_ini + 6, 'lista', '[]'::jsonb, 'eu', null);
  end if;

  with contagem as (
    select p.usuario_id, count(distinct p.data_referencia)::int as checkins, max(p.criado_em) as ultimo
      from publicacao p
      join usuario u on u.id = p.usuario_id
     where p.academia_id = v_gym
       and p.conta_para_sequencia and p.excluida_em is null
       and p.data_referencia between v_ini and v_ini + 6
       and u.status = 'ativo'
       and not public.bloqueados_entre(v_uid, p.usuario_id)
     group by p.usuario_id
  ),
  posicoes as (
    select c.*, rank() over (order by c.checkins desc)::int as posicao,
           row_number() over (order by c.checkins desc, c.ultimo asc) as ordem
      from contagem c
  ),
  linhas as (
    select ps.ordem, ps.usuario_id, jsonb_build_object(
      'posicao', ps.posicao, 'checkins', ps.checkins, 'souEu', ps.usuario_id = v_uid,
      'id', u.id, 'nome', u.nome,
      'foto', (select f.url from foto_perfil f where f.usuario_id = u.id order by f.ordem limit 1),
      'sequencia', coalesce(e.sequencia_atual, 0)) as j
      from posicoes ps
      join usuario u on u.id = ps.usuario_id
      left join estatistica_atividade e on e.usuario_id = u.id
  )
  select coalesce((select jsonb_agg(l.j order by l.ordem) from linhas l where l.ordem <= 50), '[]'::jsonb),
         (select l.j from linhas l where l.usuario_id = v_uid)
    into v_lista, v_eu;

  return jsonb_build_object(
    'academia', (select jsonb_build_object('id', a.id, 'nome', a.nome) from academia a where a.id = v_gym),
    'inicio', v_ini, 'fim', v_ini + 6, 'hoje', v_hoje,
    'lista', v_lista, 'eu', v_eu);
end;
$$;

-- ---------- US-23: privacidade (C1) ----------
create or replace function public.minha_privacidade()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'mostrarDistancia', u.mostrar_distancia,
    'visibilidadePadrao', u.visibilidade_padrao,
    'visivelDescoberta', coalesce(p.visivel, true))
  from usuario u left join preferencia_descoberta p on p.usuario_id = u.id
  where u.id = auth.uid();
$$;

create or replace function public.salvar_privacidade(
  p_mostrar_distancia boolean, p_visibilidade_padrao text, p_visivel_descoberta boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'SEM_SESSAO'; end if;
  if p_visibilidade_padrao not in ('academia_conexoes', 'conexoes') then raise exception 'VISIBILIDADE_INVALIDA'; end if;
  update usuario set mostrar_distancia = coalesce(p_mostrar_distancia, true),
                     visibilidade_padrao = p_visibilidade_padrao
   where id = auth.uid();
  insert into preferencia_descoberta (usuario_id, visivel) values (auth.uid(), coalesce(p_visivel_descoberta, true))
  on conflict (usuario_id) do update set visivel = excluded.visivel;
  return public.minha_privacidade();
end;
$$;

-- ---------- US-24 / RN-022: exclusão de conta com 30 dias de carência ----------
create or replace function public.solicitar_exclusao_conta()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'SEM_SESSAO'; end if;
  update usuario set status = 'desativado', exclusao_solicitada_em = now() where id = auth.uid();
  -- some da descoberta, conexões e feed na hora (todas as consultas filtram status = 'ativo')
  update conexao set status = 'desfeita' where status = 'ativa' and auth.uid() in (usuario1_id, usuario2_id);
  delete from preferencia_notificacao where usuario_id = auth.uid();
  return jsonb_build_object('excluirEm', now() + interval '30 days');
end;
$$;

create or replace function public.cancelar_exclusao_conta()
returns void language plpgsql security definer set search_path = public as $$
begin
  update usuario set status = 'ativo', exclusao_solicitada_em = null
   where id = auth.uid() and status = 'desativado' and exclusao_solicitada_em is not null
     and exclusao_solicitada_em > now() - interval '30 days';
end;
$$;

create or replace function public.status_conta()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'status', status,
    'excluirEm', case when exclusao_solicitada_em is null then null else exclusao_solicitada_em + interval '30 days' end)
  from usuario where id = auth.uid();
$$;

-- Apaga de vez (auth.users em cascata apaga todos os dados — RNF-002)
create or replace function public.excluir_contas_expiradas()
returns int language plpgsql security definer set search_path = public, auth as $$
declare n int;
begin
  delete from auth.users where id in (
    select id from public.usuario
     where status = 'desativado' and exclusao_solicitada_em < now() - interval '30 days');
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ---------- RN-008: buscar_parceiros respeita "mostrar distância" ----------
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
  if v_eu.academia_principal is null or cardinality(v_eu.fotos) = 0 or cardinality(v_eu.modalidades) = 0
     or cardinality(v_eu.objetivos) = 0 or cardinality(v_eu.slots) = 0 then
    raise exception 'PERFIL_INCOMPLETO';
  end if;

  select * into v_pref from preferencia_descoberta where usuario_id = v_uid;
  select * into v_minha from academia where id = v_eu.academia_principal;

  with candidatos as (
    select p.*, a.nome as academia_nome, a.latitude, a.longitude, uu.mostrar_distancia,
      case when v_minha.latitude = 0 and v_minha.longitude = 0 then null
           else distancia_km(v_minha.latitude, v_minha.longitude, a.latitude, a.longitude) end as dist
    from perfil_resumo p
    join usuario uu on uu.id = p.id
    join academia a on a.id = p.academia_principal
    left join preferencia_descoberta pp on pp.usuario_id = p.id
    where p.id <> v_uid
      and p.status = 'ativo'
      and coalesce(pp.visivel, true)
      and cardinality(p.fotos) > 0 and cardinality(p.modalidades) > 0
      and cardinality(p.objetivos) > 0 and cardinality(p.slots) > 0
      and not exists (select 1 from bloqueio b where (b.bloqueador_id = v_uid and b.bloqueado_id = p.id)
                                                  or (b.bloqueador_id = p.id and b.bloqueado_id = v_uid))
      and not exists (select 1 from conexao c where c.status = 'ativa'
                        and c.usuario1_id = least(v_uid, p.id) and c.usuario2_id = greatest(v_uid, p.id))
      and not exists (select 1 from curtida ct where ct.origem_id = v_uid and ct.destino_id = p.id
                        and (ct.tipo = 'curtir' or ct.criado_em > now() - interval '30 days'))
      and p.idade between coalesce(v_pref.idade_min, 18) and coalesce(v_pref.idade_max, 99)
      and (coalesce(cardinality(v_pref.generos), 0) = 0 or p.genero = any (v_pref.generos))
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
      -- RN-008: só distância aproximada (1 km) e só se a pessoa permitir (US-23)
      'distanciaKm', case when p.dist is null or not p.mostrar_distancia then null
                          else greatest(1, round(p.dist))::int end,
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

-- ---------- Permissões ----------
revoke execute on function public.excluir_contas_expiradas() from public, anon, authenticated;
revoke execute on function public.enviar_lembretes_sequencia() from public, anon, authenticated;
revoke execute on function public.filtrar_notificacao() from public, anon, authenticated;
revoke execute on function public.enviar_push() from public, anon, authenticated;
revoke execute on function public.notificar_mensagem() from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array[
    'listar_notificacoes(timestamptz, int)', 'contar_notificacoes_nao_lidas()', 'marcar_notificacoes_lidas(uuid[])',
    'minhas_preferencias_notificacao()', 'salvar_preferencias_notificacao(jsonb)', 'registrar_push_token(text)',
    'ranking_semanal(uuid)', 'minha_privacidade()', 'salvar_privacidade(boolean, text, boolean)',
    'solicitar_exclusao_conta()', 'cancelar_exclusao_conta()', 'status_conta()',
    'buscar_parceiros(text, text, text, int)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ---------- Agendamentos ----------
select cron.schedule('lembrete-sequencia', '0 * * * *', $$select public.enviar_lembretes_sequencia()$$);
select cron.schedule('excluir-contas-expiradas', '30 4 * * *', $$select public.excluir_contas_expiradas()$$);
