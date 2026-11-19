-- =====================================================================
-- GymBrô · US-25 (nova) — Convite para treinar
-- "Como usuário, quero convidar uma conexão para treinar comigo na minha
--  academia num dia e horário, para transformar o match em treino de verdade."
--
-- RN-025 (nova) — Convites de treino:
--  • só entre conexões ativas e sem bloqueio (como o chat, RN-014/RN-015);
--  • o local é uma academia de quem convida (principal ou secundária);
--  • o horário vai de agora até 30 dias à frente;
--  • no máximo 3 convites pendentes por conexão, de cada pessoa;
--  • quem recebe aceita ou recusa; qualquer um dos dois cancela antes do horário;
--  • convite pendente cujo horário passou é tratado como expirado.
-- =====================================================================

create table if not exists convite_treino (
  id uuid primary key default gen_random_uuid(),
  conexao_id uuid not null references conexao (id) on delete cascade,
  remetente_id uuid not null references usuario (id) on delete cascade,
  destinatario_id uuid not null references usuario (id) on delete cascade,
  academia_id uuid not null references academia (id),
  modalidade_id uuid references modalidade (id),
  inicio timestamptz not null,
  mensagem varchar(200),
  status varchar not null default 'pendente'
    check (status in ('pendente', 'aceito', 'recusado', 'cancelado')),
  respondido_em timestamptz,
  cancelado_por uuid references usuario (id),
  criado_em timestamptz not null default now(),
  check (remetente_id <> destinatario_id)
);
create index if not exists convite_conexao_idx on convite_treino (conexao_id, criado_em desc);
create index if not exists convite_destinatario_idx on convite_treino (destinatario_id, status, inicio);
create index if not exists convite_remetente_idx on convite_treino (remetente_id, status, inicio);

alter table convite_treino enable row level security;
-- Leitura só para os dois participantes de uma conexão ativa (vale para o Realtime).
-- Escrita só pelas funções abaixo.
create policy "convites da conexao" on convite_treino for select to authenticated
  using (auth.uid() in (remetente_id, destinatario_id) and public.pode_conversar(conexao_id));

-- Convite no formato do app, do ponto de vista de quem está logado
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
    'academia', jsonb_build_object('id', a.id, 'placeId', a.place_id, 'nome', a.nome, 'endereco', a.endereco),
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

-- Enviar convite
create or replace function public.convidar_treino(
  p_conexao uuid,
  p_place_id text,
  p_inicio timestamptz,
  p_modalidade text default null,
  p_mensagem text default null
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

  -- A academia precisa ser de quem convida (principal ou secundária)
  select a.id into v_academia
    from academia a join usuario_academia ua on ua.academia_id = a.id
   where ua.usuario_id = v_uid and a.place_id = p_place_id;
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

-- Aceitar ou recusar (só quem recebeu, convite pendente e no futuro)
create or replace function public.responder_convite(p_id uuid, p_aceitar boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_c convite_treino;
begin
  select * into v_c from convite_treino where id = p_id and destinatario_id = auth.uid();
  if v_c.id is null or not public.pode_conversar(v_c.conexao_id) then raise exception 'CONVITE_INDISPONIVEL'; end if;
  if v_c.status <> 'pendente' then raise exception 'CONVITE_JA_RESPONDIDO'; end if;
  if v_c.inicio < now() then raise exception 'CONVITE_EXPIRADO'; end if;

  update convite_treino
     set status = case when p_aceitar then 'aceito' else 'recusado' end, respondido_em = now()
   where id = p_id;
  -- Só o aceite gera notificação (recusar fica discreto, aparece só no status)
  if p_aceitar then
    insert into notificacao (usuario_id, tipo, referencia_id, origem_id)
    values (v_c.remetente_id, 'convite_aceito', p_id, auth.uid());
  end if;
  return public.convite_json(p_id);
end;
$$;

-- Cancelar (qualquer um dos dois, antes do horário, se pendente ou aceito)
create or replace function public.cancelar_convite(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_c convite_treino; v_outro uuid;
begin
  select * into v_c from convite_treino where id = p_id and auth.uid() in (remetente_id, destinatario_id);
  if v_c.id is null then raise exception 'CONVITE_INDISPONIVEL'; end if;
  if v_c.status not in ('pendente', 'aceito') or v_c.inicio < now() then raise exception 'CONVITE_JA_RESPONDIDO'; end if;

  update convite_treino set status = 'cancelado', cancelado_por = auth.uid(), respondido_em = now() where id = p_id;
  v_outro := case when v_c.remetente_id = auth.uid() then v_c.destinatario_id else v_c.remetente_id end;
  if v_c.status = 'aceito' then
    insert into notificacao (usuario_id, tipo, referencia_id, origem_id) values (v_outro, 'convite_cancelado', p_id, auth.uid());
  end if;
  return public.convite_json(p_id);
end;
$$;

-- Lista: de uma conversa (p_conexao) ou todos os próximos treinos (Treinos combinados)
create or replace function public.listar_convites(p_conexao uuid default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public.convite_json(c.id) order by c.inicio), '[]'::jsonb)
    from convite_treino c
   where auth.uid() in (c.remetente_id, c.destinatario_id)
     and public.pode_conversar(c.conexao_id)
     and (
       (p_conexao is not null and c.conexao_id = p_conexao and c.criado_em > now() - interval '60 days')
       or (p_conexao is null and c.status in ('pendente', 'aceito') and c.inicio > now() - interval '3 hours')
     );
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.convidar_treino(uuid, text, timestamptz, text, text)',
    'public.responder_convite(uuid, boolean)',
    'public.cancelar_convite(uuid)',
    'public.listar_convites(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  execute 'revoke execute on function public.convite_json(uuid) from public, anon, authenticated';
end $$;

do $$
begin
  alter publication supabase_realtime add table public.convite_treino;
exception when duplicate_object then null;
end $$;
