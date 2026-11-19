-- =====================================================================
-- GymBrô · Sprint 5 — correções encontradas nos testes da 0008
-- 1) Paginação do feed: cursor por (criado_em, id). Só pelo horário, publicações
--    com o mesmo instante sumiam ao carregar a página seguinte.
-- 2) Notificações: guardam quem gerou (origem_id). Curtir, descurtir e curtir de
--    novo não gera outra notificação de curtida para o autor.
-- =====================================================================

alter table notificacao add column if not exists origem_id uuid references usuario (id) on delete cascade;
create index if not exists notificacao_usuario_idx on notificacao (usuario_id, criado_em desc);
create index if not exists publicacao_cursor_idx on publicacao (criado_em desc, id desc) where excluida_em is null;

drop function if exists public.feed(text, timestamptz, int);

-- US-17 · p_antes / p_antes_id: criadoEm e id da última publicação já carregada
create or replace function public.feed(
  p_aba text default 'todos',
  p_antes timestamptz default null,
  p_antes_id uuid default null,
  p_limite int default 20
)
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
       and (p_antes is null
            or p.criado_em < p_antes
            or (p.criado_em = p_antes and p_antes_id is not null and p.id < p_antes_id))
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
     order by c.criado_em desc, c.id desc
     limit least(greatest(coalesce(p_limite, 20), 1), 50)
  )
  select coalesce(jsonb_agg(public.publicacao_json(pg.id) order by pg.criado_em desc, pg.id desc), '[]'::jsonb)
    from pagina pg
   where auth.uid() is not null;
$$;

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
    if v_autor <> v_uid and not exists (
         select 1 from notificacao
          where usuario_id = v_autor and tipo = 'curtida' and referencia_id = p_id and origem_id = v_uid) then
      insert into notificacao (usuario_id, tipo, referencia_id, origem_id) values (v_autor, 'curtida', p_id, v_uid);
    end if;
  end if;

  return jsonb_build_object(
    'curti', v_curti,
    'curtidas', (select count(*) from curtida_publicacao c
                  where c.publicacao_id = p_id and not public.bloqueados_entre(v_uid, c.usuario_id))
  );
end;
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
    insert into notificacao (usuario_id, tipo, referencia_id, origem_id) values (v_autor, 'comentario', p_publicacao, v_uid);
  end if;

  return jsonb_build_object('id', v_id, 'texto', v_texto, 'criadoEm', now(), 'editado', false,
                            'meu', true, 'podeRemover', true,
                            'autor', jsonb_build_object('id', v_uid,
                              'nome', (select nome from usuario where id = v_uid),
                              'foto', (select f.url from foto_perfil f where f.usuario_id = v_uid order by f.ordem limit 1)));
end;
$$;

revoke execute on function public.feed(text, timestamptz, uuid, int) from public, anon;
grant execute on function public.feed(text, timestamptz, uuid, int) to authenticated;
