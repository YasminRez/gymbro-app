-- Academias sugeridas não têm place_id do OpenStreetMap; o app as identifica como "gymbro:<id>".
-- convidar_treino passa a aceitar os dois formatos, e convite_json devolve o mesmo identificador do app.


create or replace function public.convidar_treino(
  p_conexao uuid, p_place_id text, p_inicio timestamptz, p_modalidade text default null, p_mensagem text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_outro uuid;
  v_academia uuid;
  v_msg text := nullif(btrim(coalesce(p_mensagem, '')), '');
  v_id uuid;
begin
  if not public.pode_conversar(p_conexao) then raise exception 'SEM_CONEXAO'; end if;
  if p_inicio is null or p_inicio < now() or p_inicio > now() + interval '30 days' then
    raise exception 'HORARIO_INVALIDO';
  end if;
  if v_msg is not null and char_length(v_msg) > 200 then raise exception 'MENSAGEM_LONGA'; end if;

  select a.id into v_academia
    from academia a join usuario_academia ua on ua.academia_id = a.id
   where ua.usuario_id = v_uid
     and (a.place_id = p_place_id or 'gymbro:' || a.id::text = p_place_id);
  if v_academia is null then raise exception 'ACADEMIA_INVALIDA'; end if;

  if (select count(*) from convite_treino
       where conexao_id = p_conexao and remetente_id = v_uid and status = 'pendente' and inicio > now()) >= 3 then
    raise exception 'LIMITE_CONVITES';
  end if;

  select case when usuario1_id = v_uid then usuario2_id else usuario1_id end into v_outro
    from conexao where id = p_conexao;

  insert into convite_treino (conexao_id, remetente_id, destinatario_id, academia_id, modalidade_id, inicio, mensagem)
  values (p_conexao, v_uid, v_outro, v_academia, (select id from modalidade where nome = p_modalidade), p_inicio, v_msg)
  returning id into v_id;

  insert into notificacao (usuario_id, tipo, referencia_id, origem_id) values (v_outro, 'convite', v_id, v_uid);
  return public.convite_json(v_id);
end;
$$;

create or replace function public.convite_json(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', c.id,
    'conexaoId', c.conexao_id,
    'enviado', c.remetente_id = auth.uid(),
    'status', case when c.status = 'pendente' and c.inicio < now() then 'expirado' else c.status end,
    'inicio', c.inicio,
    'mensagem', c.mensagem,
    'modalidade', m.nome,
    'criadoEm', c.criado_em,
    'respondidoEm', c.respondido_em,
    'canceladoPorMim', c.cancelado_por = auth.uid(),
    'academia', jsonb_build_object('id', a.id, 'placeId', coalesce(a.place_id, 'gymbro:' || a.id::text),
                                   'nome', a.nome, 'endereco', a.endereco),
    'pessoa', jsonb_build_object(
      'id', u.id, 'nome', u.nome,
      'foto', (select f.url from foto_perfil f where f.usuario_id = u.id order by f.ordem limit 1))
  )
  from convite_treino c
  join academia a on a.id = c.academia_id
  left join modalidade m on m.id = c.modalidade_id
  join usuario u on u.id = case when c.remetente_id = auth.uid() then c.destinatario_id else c.remetente_id end
  where c.id = p_id;
$$;
revoke execute on function public.convite_json(uuid) from public, anon, authenticated;
revoke execute on function public.convidar_treino(uuid, text, timestamptz, text, text) from public, anon;
grant execute on function public.convidar_treino(uuid, text, timestamptz, text, text) to authenticated;
