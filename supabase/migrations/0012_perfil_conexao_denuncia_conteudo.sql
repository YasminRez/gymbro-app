-- =====================================================================
-- 0012 · Ajustes da auditoria
--   • distancia_km: academia sem coordenadas (0,0) não entra no filtro de distância
--   • perfil_publico: devolve conexaoId quando há conexão ativa (D4 sabe se pode
--     mandar mensagem / convidar para treinar)
--   • US-14: denunciar publicação ou comentário (além de perfil e mensagem)
-- =====================================================================

create or replace function public.distancia_km(lat1 float8, lng1 float8, lat2 float8, lng2 float8)
returns float8
language sql
immutable
as $$
  select case
    when (lat1 = 0 and lng1 = 0) or (lat2 = 0 and lng2 = 0) then null
    else 2 * 6371 * asin(sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2) +
      cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
    ))
  end;
$$;

create or replace function public.perfil_publico(p_id uuid)
returns jsonb
language sql
stable security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', p.id, 'nome', p.nome, 'idade', p.idade, 'genero', p.genero, 'bio', p.bio, 'nivel', p.nivel,
    'fotos', to_jsonb(p.fotos), 'academia', a.nome, 'slots', to_jsonb(p.slots),
    'modalidades', to_jsonb(p.modalidades), 'objetivos', to_jsonb(p.objetivos),
    'interesses', to_jsonb(p.interesses),
    'interessesComuns', to_jsonb(array(select x from unnest(p.interesses) x
                                       where x in (select unnest(r.interesses) from perfil_resumo r where r.id = auth.uid()))),
    'diasAtivos', p.dias_ativos, 'sequencia', p.sequencia_atual,
    'conexaoId', (select c.id from conexao c
                   where c.status = 'ativa'
                     and c.usuario1_id = least(auth.uid(), p.id)
                     and c.usuario2_id = greatest(auth.uid(), p.id))
  )
  from perfil_resumo p
  left join academia a on a.id = p.academia_principal
  where p.id = p_id and auth.uid() is not null and p.status = 'ativo'
    and not exists (select 1 from bloqueio b where (b.bloqueador_id = auth.uid() and b.bloqueado_id = p.id)
                                                or (b.bloqueador_id = p.id and b.bloqueado_id = auth.uid()));
$$;

alter table public.denuncia add column if not exists comentario_id uuid references public.comentario(id) on delete set null;

drop function if exists public.denunciar(uuid, text, text, uuid);
create or replace function public.denunciar(
  p_denunciado uuid, p_motivo text, p_descricao text default null, p_mensagem uuid default null,
  p_publicacao uuid default null, p_comentario uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qtd int;
  v_msg uuid := p_mensagem;
  v_pub uuid := p_publicacao;
  v_com uuid := p_comentario;
begin
  if p_denunciado is null or p_denunciado = auth.uid() then
    raise exception 'ACAO_INVALIDA';
  end if;
  -- Só guarda a referência se o conteúdo for mesmo do denunciado
  if v_msg is not null and not exists (select 1 from mensagem where id = v_msg and remetente_id = p_denunciado) then
    v_msg := null;
  end if;
  if v_pub is not null and not exists (select 1 from publicacao where id = v_pub and usuario_id = p_denunciado) then
    v_pub := null;
  end if;
  if v_com is not null and not exists (select 1 from comentario where id = v_com and usuario_id = p_denunciado) then
    v_com := null;
  end if;

  insert into denuncia (denunciante_id, denunciado_id, motivo, descricao, mensagem_id, publicacao_id, comentario_id, status)
  values (auth.uid(), p_denunciado, p_motivo, nullif(btrim(coalesce(p_descricao, '')), ''), v_msg, v_pub, v_com, 'em_analise');

  -- RN-016: 3 denunciantes distintos em 30 dias → suspensão preventiva
  select count(distinct denunciante_id) into v_qtd
    from denuncia
   where denunciado_id = p_denunciado
     and criado_em > now() - interval '30 days';
  if v_qtd >= 3 then
    update usuario set status = 'suspenso' where id = p_denunciado and status = 'ativo';
  end if;
end;
$$;

revoke execute on function public.denunciar(uuid, text, text, uuid, uuid, uuid) from public, anon;
grant execute on function public.denunciar(uuid, text, text, uuid, uuid, uuid) to authenticated;
