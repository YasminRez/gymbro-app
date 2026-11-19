-- =====================================================================
-- GymBrô · Sprint 5 — Feed e constância
-- US-15 Publicar (check-in) · US-16 Dias ativos e sequência · US-17 Feed
-- US-18 Curtir · US-19 Comentar · US-20 Excluir publicação
-- RN-017 Check-in diário (1º post do dia civil no fuso do usuário, sem retroativo)
-- RN-018 Sequência com 1 dia de descanso por semana (segunda a domingo)
-- RN-019 Ao excluir o check-in, transfere para outro post do dia ou recalcula
-- RN-020 Comentários de 1 a 300 caracteres, sem termos bloqueados
-- RN-021 Visibilidade: "Minha academia e conexões" (padrão) ou "Somente conexões"
-- RN-015 Bloqueio esconde publicações, curtidas e comentários dos dois lados
--
-- Tudo passa por funções (security definer). As tabelas do feed continuam sem
-- acesso direto pelo app (RLS ligado e sem políticas).
-- =====================================================================

-- ---------- Ajustes nas tabelas ----------

-- Fuso do usuário: define o "dia civil" do check-in e o recálculo diário
alter table usuario add column if not exists fuso varchar not null default 'America/Sao_Paulo';

-- US-15, cenário 5: reenvio após falha não duplica a publicação
alter table publicacao add column if not exists client_id uuid;
create unique index if not exists publicacao_client_idx
  on publicacao (usuario_id, client_id) where client_id is not null;
alter table publicacao
  add constraint publicacao_legenda_tamanho check (legenda is null or char_length(legenda) <= 300),
  add constraint publicacao_duracao check (duracao_min is null or duracao_min between 1 and 600);
create index if not exists publicacao_feed_idx on publicacao (criado_em desc) where excluida_em is null;
create index if not exists publicacao_usuario_idx on publicacao (usuario_id, data_referencia);

-- US-19, cenário 2: indicação "editado"
alter table comentario add column if not exists editado_em timestamptz;
create index if not exists comentario_publicacao_idx on comentario (publicacao_id, criado_em);

-- RN-020: lista de palavras bloqueadas mantida pela moderação (Table Editor do Supabase)
create table if not exists palavra_bloqueada (
  termo varchar primary key check (termo = lower(termo))
);
alter table palavra_bloqueada enable row level security;
insert into palavra_bloqueada (termo) values
  ('idiota'), ('imbecil'), ('otario'), ('babaca'), ('retardado'), ('lixo humano'), ('vagabundo'), ('vagabunda')
on conflict do nothing;

-- ---------- Storage: fotos das publicações ----------
insert into storage.buckets (id, name, public) values ('publicacoes', 'publicacoes', true)
on conflict (id) do nothing;

create policy "publicacoes: dono envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'publicacoes' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "publicacoes: dono apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'publicacoes' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- Funções internas (não chamáveis pelo app) ----------

-- Remove acentos e põe em minúsculas, para comparar com a lista de termos
create or replace function public.normalizar_texto(t text)
returns text language sql immutable set search_path = public as $$
  select lower(translate(coalesce(t, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucaaaaaeeeeiiiiooooouuuuc'));
$$;

-- RN-020: o texto contém algum termo bloqueado (palavra inteira)?
create or replace function public.contem_termo_bloqueado(t text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from palavra_bloqueada p
     where public.normalizar_texto(t) ~ ('\m' || regexp_replace(p.termo, '([.*+?^${}()|\[\]\\])', '\\\1', 'g') || '\M')
  );
$$;

-- RN-021 + RN-015: o usuário logado pode ver esta publicação?
create or replace function public.pode_ver_publicacao(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from publicacao p
      join usuario u on u.id = p.usuario_id
     where p.id = p_id
       and p.excluida_em is null
       and u.status = 'ativo'
       and not public.bloqueados_entre(auth.uid(), p.usuario_id)
       and (
         p.usuario_id = auth.uid()
         or exists (select 1 from conexao c
                     where c.status = 'ativa'
                       and c.usuario1_id = least(auth.uid(), p.usuario_id)
                       and c.usuario2_id = greatest(auth.uid(), p.usuario_id))
         or (p.visibilidade = 'academia_conexoes'
             and p.academia_id in (select ua.academia_id from usuario_academia ua where ua.usuario_id = auth.uid()))
       )
  );
$$;

-- Uma publicação no formato que o app usa
create or replace function public.publicacao_json(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', p.id,
    'fotoUrl', p.foto_url,
    'legenda', p.legenda,
    'duracaoMin', p.duracao_min,
    'modalidade', m.nome,
    'academia', a.nome,
    'visibilidade', p.visibilidade,
    'checkin', p.conta_para_sequencia,
    'data', p.data_referencia,
    'criadoEm', p.criado_em,
    'minha', p.usuario_id = auth.uid(),
    'curti', exists (select 1 from curtida_publicacao c where c.publicacao_id = p.id and c.usuario_id = auth.uid()),
    'curtidas', (select count(*) from curtida_publicacao c
                  where c.publicacao_id = p.id and not public.bloqueados_entre(auth.uid(), c.usuario_id)),
    'comentarios', (select count(*) from comentario c
                     where c.publicacao_id = p.id and not public.bloqueados_entre(auth.uid(), c.usuario_id)),
    'autor', jsonb_build_object(
      'id', u.id,
      'nome', u.nome,
      'foto', (select f.url from foto_perfil f where f.usuario_id = u.id order by f.ordem limit 1),
      'sequencia', coalesce(e.sequencia_atual, 0)
    )
  )
  from publicacao p
  join usuario u on u.id = p.usuario_id
  left join modalidade m on m.id = p.modalidade_id
  left join academia a on a.id = p.academia_id
  left join estatistica_atividade e on e.usuario_id = u.id
  where p.id = p_id;
$$;

-- RN-018: recalcula dias ativos e sequência (mesma regra de src/domain/streak.ts)
create or replace function public.recalcular_estatistica(p_usuario uuid)
returns estatistica_atividade
language plpgsql security definer set search_path = public as $$
declare
  v_fuso text;
  v_hoje date;
  v_dias date[];
  v_ini date;
  d date;
  v_semana date;
  v_descanso boolean := false;
  v_total int := 0;
  v_atual int := 0;
  v_maior int := 0;
  v_ultima date;
  v_row estatistica_atividade;
begin
  select coalesce(fuso, 'America/Sao_Paulo') into v_fuso from usuario where id = p_usuario;
  v_hoje := (now() at time zone coalesce(v_fuso, 'America/Sao_Paulo'))::date;

  select array_agg(distinct data_referencia order by data_referencia), min(data_referencia), max(data_referencia)
    into v_dias, v_ini, v_ultima
    from publicacao
   where usuario_id = p_usuario and conta_para_sequencia and excluida_em is null;

  if v_ini is not null then
    v_semana := date_trunc('week', v_ini)::date; -- semana começa na segunda
    for d in select generate_series(v_ini, v_hoje, interval '1 day')::date loop
      if date_trunc('week', d)::date <> v_semana then
        v_semana := date_trunc('week', d)::date;
        v_descanso := false;
      end if;
      if d = any (v_dias) then
        v_total := v_total + 1;
        v_atual := v_atual + 1;
        v_maior := greatest(v_maior, v_atual);
      elsif d = v_hoje then
        null; -- hoje ainda pode ter check-in
      elsif not v_descanso then
        v_descanso := true; -- 1 dia de descanso por semana mantém a sequência
      else
        v_atual := 0;
      end if;
    end loop;
  end if;

  insert into estatistica_atividade (usuario_id, total_dias_ativos, sequencia_atual, maior_sequencia, ultima_data_ativa)
  values (p_usuario, v_total, v_atual, v_maior, v_ultima)
  on conflict (usuario_id) do update
    set total_dias_ativos = excluded.total_dias_ativos,
        sequencia_atual = excluded.sequencia_atual,
        maior_sequencia = excluded.maior_sequencia,
        ultima_data_ativa = excluded.ultima_data_ativa
  returning * into v_row;
  return v_row;
end;
$$;

-- Recálculo diário de todo mundo que já fez check-in (agendado abaixo)
create or replace function public.recalcular_todas_estatisticas()
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select distinct usuario_id from publicacao where conta_para_sequencia and excluida_em is null loop
    perform public.recalcular_estatistica(r.usuario_id);
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Estatísticas no formato do app, com os dias ativos do mês
create or replace function public.estatistica_json(p_usuario uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'totalDiasAtivos', e.total_dias_ativos,
    'sequenciaAtual', e.sequencia_atual,
    'maiorSequencia', e.maior_sequencia,
    'diasNoMes', (select count(distinct p.data_referencia) from publicacao p
                   where p.usuario_id = p_usuario and p.conta_para_sequencia and p.excluida_em is null
                     and date_trunc('month', p.data_referencia) =
                         date_trunc('month', (now() at time zone u.fuso)::date)),
    'hoje', (now() at time zone u.fuso)::date
  )
  from estatistica_atividade e join usuario u on u.id = e.usuario_id
  where e.usuario_id = p_usuario;
$$;

-- ---------- US-15: publicar ----------
create or replace function public.publicar(
  p_foto_url text,
  p_legenda text default null,
  p_modalidade text default null,
  p_duracao_min int default null,
  p_visibilidade text default 'academia_conexoes',
  p_fuso text default 'America/Sao_Paulo',
  p_client_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_hoje date;
  v_id uuid;
  v_checkin boolean;
  v_antes estatistica_atividade;
  v_depois estatistica_atividade;
  v_legenda text := nullif(btrim(coalesce(p_legenda, '')), '');
begin
  if v_uid is null then raise exception 'SEM_SESSAO'; end if;
  if coalesce(btrim(p_foto_url), '') = '' then raise exception 'SEM_FOTO'; end if;
  if v_legenda is not null and char_length(v_legenda) > 300 then raise exception 'LEGENDA_LONGA'; end if;
  if p_visibilidade not in ('academia_conexoes', 'conexoes') then raise exception 'VISIBILIDADE_INVALIDA'; end if;
  if p_duracao_min is not null and p_duracao_min not between 1 and 600 then raise exception 'DURACAO_INVALIDA'; end if;

  -- Reenvio da mesma publicação (US-15, cenário 5)
  if p_client_id is not null then
    select id into v_id from publicacao where usuario_id = v_uid and client_id = p_client_id;
    if v_id is not null then
      return jsonb_build_object('publicacao', public.publicacao_json(v_id),
                                'checkin', (select conta_para_sequencia from publicacao where id = v_id),
                                'novoRecorde', false,
                                'estatisticas', public.estatistica_json(v_uid));
    end if;
  end if;

  -- RN-017: o dia é o de agora no fuso do usuário (nunca retroativo)
  begin
    perform now() at time zone p_fuso;
  exception when others then
    p_fuso := 'America/Sao_Paulo';
  end;
  update usuario set fuso = p_fuso where id = v_uid and fuso is distinct from p_fuso;
  v_hoje := (now() at time zone p_fuso)::date;

  select * into v_antes from estatistica_atividade where usuario_id = v_uid;
  v_checkin := not exists (select 1 from publicacao
                            where usuario_id = v_uid and data_referencia = v_hoje
                              and conta_para_sequencia and excluida_em is null);

  begin
    insert into publicacao (usuario_id, academia_id, modalidade_id, foto_url, legenda, duracao_min,
                            data_referencia, conta_para_sequencia, visibilidade, client_id)
    values (v_uid,
            (select academia_id from usuario_academia where usuario_id = v_uid and tipo = 'principal' limit 1),
            (select id from modalidade where nome = p_modalidade),
            btrim(p_foto_url), v_legenda, p_duracao_min, v_hoje, v_checkin, p_visibilidade, p_client_id)
    returning id into v_id;
  exception when unique_violation then
    -- Duas publicações ao mesmo tempo: só uma vira check-in (índice um_checkin_por_dia)
    v_checkin := false;
    insert into publicacao (usuario_id, academia_id, modalidade_id, foto_url, legenda, duracao_min,
                            data_referencia, conta_para_sequencia, visibilidade, client_id)
    values (v_uid,
            (select academia_id from usuario_academia where usuario_id = v_uid and tipo = 'principal' limit 1),
            (select id from modalidade where nome = p_modalidade),
            btrim(p_foto_url), v_legenda, p_duracao_min, v_hoje, false, p_visibilidade, p_client_id)
    returning id into v_id;
  end;

  v_depois := public.recalcular_estatistica(v_uid);

  return jsonb_build_object(
    'publicacao', public.publicacao_json(v_id),
    'checkin', v_checkin,
    -- US-16, cenário 5: "Novo recorde: {n} dias seguidos!"
    'novoRecorde', v_checkin and v_depois.maior_sequencia >= 2
                   and v_depois.maior_sequencia > coalesce(v_antes.maior_sequencia, 0),
    'estatisticas', public.estatistica_json(v_uid)
  );
end;
$$;

-- ---------- US-17: feed ----------
-- p_aba: 'todos' | 'conexoes' | 'academia' · p_antes: cursor (criadoEm da última publicação carregada)
create or replace function public.feed(p_aba text default 'todos', p_antes timestamptz default null, p_limite int default 20)
returns jsonb language sql stable security definer set search_path = public as $$
  with
  minhas_academias as (
    select academia_id from usuario_academia where usuario_id = auth.uid()
  ),
  conexoes as (
    select case when usuario1_id = auth.uid() then usuario2_id else usuario1_id end as id
      from conexao where status = 'ativa' and auth.uid() in (usuario1_id, usuario2_id)
  ),
  candidatas as (
    select p.id, p.criado_em, p.usuario_id, p.visibilidade,
           p.usuario_id in (select id from conexoes) as de_conexao,
           p.academia_id in (select academia_id from minhas_academias) as da_academia
      from publicacao p
      join usuario u on u.id = p.usuario_id
     where p.excluida_em is null
       and u.status = 'ativo'
       and (p_antes is null or p.criado_em < p_antes)
       and not public.bloqueados_entre(auth.uid(), p.usuario_id)
  ),
  pagina as (
    select c.id, c.criado_em from candidatas c
     where case coalesce(p_aba, 'todos')
             when 'conexoes' then c.de_conexao
             when 'academia' then coalesce(c.da_academia, false)
                                  and (c.visibilidade = 'academia_conexoes' or c.de_conexao or c.usuario_id = auth.uid())
             else c.usuario_id = auth.uid() or c.de_conexao
                  or (coalesce(c.da_academia, false) and c.visibilidade = 'academia_conexoes')
           end
     order by c.criado_em desc
     limit least(greatest(coalesce(p_limite, 20), 1), 50)
  )
  select coalesce(jsonb_agg(public.publicacao_json(pg.id) order by pg.criado_em desc), '[]'::jsonb)
    from pagina pg
   where auth.uid() is not null;
$$;

-- ---------- US-18: curtir ----------
create or replace function public.curtir_publicacao(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_autor uuid;
  v_curti boolean;
begin
  if not public.pode_ver_publicacao(p_id) then raise exception 'PUBLICACAO_INDISPONIVEL'; end if;
  select usuario_id into v_autor from publicacao where id = p_id;

  if exists (select 1 from curtida_publicacao where usuario_id = v_uid and publicacao_id = p_id) then
    delete from curtida_publicacao where usuario_id = v_uid and publicacao_id = p_id;
    v_curti := false;
  else
    insert into curtida_publicacao (usuario_id, publicacao_id) values (v_uid, p_id) on conflict do nothing;
    v_curti := true;
    if v_autor <> v_uid then
      insert into notificacao (usuario_id, tipo, referencia_id) values (v_autor, 'curtida', p_id);
    end if;
  end if;

  return jsonb_build_object(
    'curti', v_curti,
    'curtidas', (select count(*) from curtida_publicacao c
                  where c.publicacao_id = p_id and not public.bloqueados_entre(v_uid, c.usuario_id))
  );
end;
$$;

-- US-18, cenário 3: quem curtiu (sem bloqueados)
create or replace function public.curtidas_da_publicacao(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', u.id, 'nome', u.nome,
           'foto', (select f.url from foto_perfil f where f.usuario_id = u.id order by f.ordem limit 1)
         ) order by c.criado_em desc), '[]'::jsonb)
    from curtida_publicacao c
    join usuario u on u.id = c.usuario_id
   where c.publicacao_id = p_id
     and public.pode_ver_publicacao(p_id)
     and u.status = 'ativo'
     and not public.bloqueados_entre(auth.uid(), c.usuario_id);
$$;

-- ---------- US-19: comentários ----------
create or replace function public.comentarios_da_publicacao(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id,
           'texto', c.texto,
           'criadoEm', c.criado_em,
           'editado', c.editado_em is not null,
           'meu', c.usuario_id = auth.uid(),
           -- quem escreveu pode editar/excluir; o autor da publicação pode remover (cenários 2 e 3)
           'podeRemover', c.usuario_id = auth.uid() or p.usuario_id = auth.uid(),
           'autor', jsonb_build_object(
             'id', u.id, 'nome', u.nome,
             'foto', (select f.url from foto_perfil f where f.usuario_id = u.id order by f.ordem limit 1))
         ) order by c.criado_em), '[]'::jsonb)
    from comentario c
    join publicacao p on p.id = c.publicacao_id
    join usuario u on u.id = c.usuario_id
   where c.publicacao_id = p_id
     and public.pode_ver_publicacao(p_id)
     and u.status = 'ativo'
     and not public.bloqueados_entre(auth.uid(), c.usuario_id);
$$;

create or replace function public.comentar(p_publicacao uuid, p_texto text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_texto text := btrim(coalesce(p_texto, ''));
  v_autor uuid;
  v_id uuid;
begin
  if not public.pode_ver_publicacao(p_publicacao) then raise exception 'PUBLICACAO_INDISPONIVEL'; end if;
  if char_length(v_texto) not between 1 and 300 then raise exception 'COMENTARIO_INVALIDO'; end if;
  if public.contem_termo_bloqueado(v_texto) then raise exception 'TERMO_BLOQUEADO'; end if;

  insert into comentario (publicacao_id, usuario_id, texto) values (p_publicacao, v_uid, v_texto)
  returning id into v_id;

  select usuario_id into v_autor from publicacao where id = p_publicacao;
  if v_autor <> v_uid then
    insert into notificacao (usuario_id, tipo, referencia_id) values (v_autor, 'comentario', p_publicacao);
  end if;

  return jsonb_build_object('id', v_id, 'texto', v_texto, 'criadoEm', now(), 'editado', false,
                            'meu', true, 'podeRemover', true,
                            'autor', jsonb_build_object('id', v_uid,
                              'nome', (select nome from usuario where id = v_uid),
                              'foto', (select f.url from foto_perfil f where f.usuario_id = v_uid order by f.ordem limit 1)));
end;
$$;

create or replace function public.editar_comentario(p_id uuid, p_texto text)
returns void language plpgsql security definer set search_path = public as $$
declare v_texto text := btrim(coalesce(p_texto, ''));
begin
  if char_length(v_texto) not between 1 and 300 then raise exception 'COMENTARIO_INVALIDO'; end if;
  if public.contem_termo_bloqueado(v_texto) then raise exception 'TERMO_BLOQUEADO'; end if;
  update comentario set texto = v_texto, editado_em = now()
   where id = p_id and usuario_id = auth.uid();
  if not found then raise exception 'ACAO_INVALIDA'; end if;
end;
$$;

create or replace function public.excluir_comentario(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from comentario c
   using publicacao p
   where c.id = p_id and p.id = c.publicacao_id
     and (c.usuario_id = auth.uid() or p.usuario_id = auth.uid());
  if not found then raise exception 'ACAO_INVALIDA'; end if;
end;
$$;

-- ---------- US-20: excluir publicação (RN-019) ----------
create or replace function public.excluir_publicacao(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_pub publicacao;
  v_outra uuid;
begin
  select * into v_pub from publicacao where id = p_id and usuario_id = v_uid and excluida_em is null;
  if v_pub.id is null then raise exception 'ACAO_INVALIDA'; end if;

  -- Exclusão lógica: some do app na hora e fica 30 dias para a moderação
  update publicacao set excluida_em = now(), conta_para_sequencia = false where id = p_id;

  if v_pub.conta_para_sequencia then
    -- RN-019: transfere o check-in para a publicação restante mais antiga do mesmo dia
    select id into v_outra from publicacao
     where usuario_id = v_uid and data_referencia = v_pub.data_referencia and excluida_em is null
     order by criado_em limit 1;
    if v_outra is not null then
      update publicacao set conta_para_sequencia = true where id = v_outra;
    end if;
    perform public.recalcular_estatistica(v_uid);
  end if;

  return jsonb_build_object(
    'eraCheckin', v_pub.conta_para_sequencia,
    'transferidoPara', v_outra,
    'estatisticas', public.estatistica_json(v_uid)
  );
end;
$$;

-- ---------- US-16: meus contadores e calendário ----------
create or replace function public.minhas_estatisticas(p_mes date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_mes date;
begin
  if v_uid is null then raise exception 'SEM_SESSAO'; end if;
  perform public.recalcular_estatistica(v_uid); -- sempre atualizado ao abrir o perfil
  v_mes := date_trunc('month', coalesce(p_mes,
             (now() at time zone (select fuso from usuario where id = v_uid))::date))::date;

  return public.estatistica_json(v_uid) || jsonb_build_object(
    -- todas as datas de check-in: o app calcula os dias de descanso com a mesma regra
    'datas', coalesce((select jsonb_agg(distinct p.data_referencia) from publicacao p
                        where p.usuario_id = v_uid and p.conta_para_sequencia and p.excluida_em is null), '[]'::jsonb),
    -- miniaturas do mês pedido
    'mes', coalesce((select jsonb_agg(jsonb_build_object('data', p.data_referencia, 'fotoUrl', p.foto_url, 'id', p.id)
                                      order by p.data_referencia)
                       from publicacao p
                      where p.usuario_id = v_uid and p.conta_para_sequencia and p.excluida_em is null
                        and date_trunc('month', p.data_referencia) = v_mes), '[]'::jsonb)
  );
end;
$$;

-- ---------- Permissões ----------
do $$
declare f text;
begin
  -- Chamáveis pelo app (só logado)
  foreach f in array array[
    'public.publicar(text, text, text, int, text, text, uuid)',
    'public.feed(text, timestamptz, int)',
    'public.curtir_publicacao(uuid)',
    'public.curtidas_da_publicacao(uuid)',
    'public.comentarios_da_publicacao(uuid)',
    'public.comentar(uuid, text)',
    'public.editar_comentario(uuid, text)',
    'public.excluir_comentario(uuid)',
    'public.excluir_publicacao(uuid)',
    'public.minhas_estatisticas(date)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;

  -- Internas: só as funções acima usam (rodam como dono)
  foreach f in array array[
    'public.normalizar_texto(text)',
    'public.contem_termo_bloqueado(text)',
    'public.pode_ver_publicacao(uuid)',
    'public.publicacao_json(uuid)',
    'public.recalcular_estatistica(uuid)',
    'public.recalcular_todas_estatisticas()',
    'public.estatistica_json(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;

-- ---------- US-16: recálculo diário às 00h05 de Brasília (03h05 UTC) ----------
create extension if not exists pg_cron;
select cron.schedule('recalcular-sequencias', '5 3 * * *', $$select public.recalcular_todas_estatisticas()$$);
