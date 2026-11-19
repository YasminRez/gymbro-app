-- =====================================================================
-- GymBrô · Sprint 4 — Conexões, chat e segurança
-- US-11 Gerenciar conexões · US-12 Chat · US-13 Bloquear · US-14 Denunciar
-- RN-014 Chat restrito a conexões ativas
-- RN-015 Bloqueio mútuo e invisibilidade (o bloqueado não é notificado)
-- RN-016 Suspensão preventiva com 3 denúncias de pessoas diferentes em 30 dias
-- RNF-004 Mensagem entregue em até 2 s (Supabase Realtime)
-- =====================================================================

-- ---------- Ajustes nas tabelas ----------

-- US-12: até 1000 caracteres, sem mensagem vazia
alter table mensagem
  add constraint mensagem_tamanho check (char_length(btrim(conteudo)) between 1 and 1000);

-- US-12, cenário 4 (envio sem internet): o app gera um id antes de enviar.
-- Se a mesma mensagem for reenviada ao voltar a internet, ela não duplica.
alter table mensagem add column if not exists client_id uuid;
create unique index if not exists mensagem_client_idx
  on mensagem (remetente_id, client_id) where client_id is not null;
create index if not exists mensagem_conexao_idx on mensagem (conexao_id, enviada_em desc);

-- US-14: motivo da lista, descrição opcional e a mensagem denunciada (se houver)
alter table denuncia add column if not exists descricao varchar(500);
alter table denuncia add column if not exists mensagem_id uuid references mensagem (id) on delete set null;
alter table denuncia
  add constraint denuncia_motivo check (motivo in ('assedio', 'conteudo_improprio', 'perfil_falso', 'spam', 'outro'));
create index if not exists denuncia_denunciado_idx on denuncia (denunciado_id, criado_em);

-- ---------- Funções auxiliares ----------

-- RN-015: existe bloqueio em qualquer um dos sentidos?
create or replace function public.bloqueados_entre(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from bloqueio
     where (bloqueador_id = a and bloqueado_id = b)
        or (bloqueador_id = b and bloqueado_id = a)
  );
$$;

-- RN-014 + RN-015: o usuário logado pode conversar nesta conexão?
create or replace function public.pode_conversar(p_conexao uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from conexao c
     where c.id = p_conexao
       and c.status = 'ativa'
       and auth.uid() in (c.usuario1_id, c.usuario2_id)
       and not public.bloqueados_entre(c.usuario1_id, c.usuario2_id)
  );
$$;

-- ---------- RLS das mensagens (vale também para o Realtime) ----------
create policy "ler mensagens de conexao ativa" on mensagem for select to authenticated
  using (public.pode_conversar(conexao_id));
create policy "enviar mensagem em conexao ativa" on mensagem for insert to authenticated
  with check (remetente_id = auth.uid() and public.pode_conversar(conexao_id));

-- ---------- US-11: lista de conexões ----------
-- Novas conexões (sem mensagens) e conversas com a última mensagem e as não lidas.
create or replace function public.listar_conexoes()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(item), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', c.id,
      'criadaEm', c.criado_em,
      'pessoa', jsonb_build_object('id', p.id, 'nome', p.nome, 'foto', p.fotos[1]),
      'ultimaMensagem', (
        select jsonb_build_object('conteudo', m.conteudo, 'enviadaEm', m.enviada_em,
                                  'minha', m.remetente_id = auth.uid())
          from mensagem m where m.conexao_id = c.id
         order by m.enviada_em desc limit 1),
      'naoLidas', (
        select count(*) from mensagem m
         where m.conexao_id = c.id and m.remetente_id <> auth.uid() and m.lida_em is null)
    ) as item
    from conexao c
    join perfil_resumo p
      on p.id = case when c.usuario1_id = auth.uid() then c.usuario2_id else c.usuario1_id end
    where c.status = 'ativa'
      and auth.uid() in (c.usuario1_id, c.usuario2_id)
      and p.status = 'ativo'
      and not public.bloqueados_entre(c.usuario1_id, c.usuario2_id)
  ) t;
$$;

-- ---------- US-12: cabeçalho da conversa ----------
create or replace function public.conversa(p_conexao uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', c.id,
    'ativa', public.pode_conversar(c.id),
    'pessoa', jsonb_build_object('id', p.id, 'nome', p.nome, 'foto', p.fotos[1])
  )
  from conexao c
  join perfil_resumo p
    on p.id = case when c.usuario1_id = auth.uid() then c.usuario2_id else c.usuario1_id end
  where c.id = p_conexao and auth.uid() in (c.usuario1_id, c.usuario2_id);
$$;

-- ---------- US-12: enviar (idempotente pelo client_id) ----------
create or replace function public.enviar_mensagem(p_conexao uuid, p_conteudo text, p_client_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_msg mensagem;
begin
  if not public.pode_conversar(p_conexao) then
    raise exception 'SEM_CONEXAO';
  end if;
  if char_length(btrim(coalesce(p_conteudo, ''))) not between 1 and 1000 then
    raise exception 'MENSAGEM_INVALIDA';
  end if;

  insert into mensagem (conexao_id, remetente_id, conteudo, client_id)
  values (p_conexao, auth.uid(), btrim(p_conteudo), p_client_id)
  on conflict (remetente_id, client_id) where client_id is not null do nothing
  returning * into v_msg;

  if v_msg.id is null then
    select * into v_msg from mensagem where remetente_id = auth.uid() and client_id = p_client_id;
  end if;

  return jsonb_build_object(
    'id', v_msg.id, 'conexaoId', v_msg.conexao_id, 'remetenteId', v_msg.remetente_id,
    'conteudo', v_msg.conteudo, 'enviadaEm', v_msg.enviada_em, 'lidaEm', v_msg.lida_em,
    'clientId', v_msg.client_id
  );
end;
$$;

-- US-12, cenário 2: marcar como lidas as mensagens recebidas
create or replace function public.marcar_lidas(p_conexao uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update mensagem set lida_em = now()
   where conexao_id = p_conexao
     and remetente_id <> auth.uid()
     and lida_em is null
     and public.pode_conversar(p_conexao);
$$;

-- ---------- US-11: desfazer conexão (RN-014: encerra para os dois) ----------
create or replace function public.desfazer_conexao(p_conexao uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update conexao set status = 'desfeita'
   where id = p_conexao and status = 'ativa' and auth.uid() in (usuario1_id, usuario2_id);
  if not found then
    raise exception 'CONEXAO_INEXISTENTE';
  end if;
end;
$$;

-- ---------- US-13: bloquear / desbloquear ----------
create or replace function public.bloquear_usuario(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_id is null or p_id = auth.uid() then
    raise exception 'ACAO_INVALIDA';
  end if;
  insert into bloqueio (bloqueador_id, bloqueado_id) values (auth.uid(), p_id) on conflict do nothing;
  -- RN-015: a conexão é desfeita. Nenhuma notificação é criada para o bloqueado.
  update conexao set status = 'desfeita'
   where status = 'ativa'
     and usuario1_id = least(auth.uid(), p_id)
     and usuario2_id = greatest(auth.uid(), p_id);
end;
$$;

-- Cenário 2: remove o bloqueio, mas a conexão anterior não é restaurada
create or replace function public.desbloquear_usuario(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from bloqueio where bloqueador_id = auth.uid() and bloqueado_id = p_id;
$$;

-- C3: lista de usuários bloqueados
create or replace function public.listar_bloqueados()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', u.id,
           'nome', u.nome,
           'foto', (select f.url from foto_perfil f where f.usuario_id = u.id order by f.ordem limit 1),
           'desde', b.criado_em
         ) order by b.criado_em desc), '[]'::jsonb)
  from bloqueio b
  join usuario u on u.id = b.bloqueado_id
  where b.bloqueador_id = auth.uid();
$$;

-- ---------- US-14: denunciar + RN-016 ----------
create or replace function public.denunciar(
  p_denunciado uuid,
  p_motivo text,
  p_descricao text default null,
  p_mensagem uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_qtd int;
  v_msg uuid := p_mensagem;
begin
  if p_denunciado is null or p_denunciado = auth.uid() then
    raise exception 'ACAO_INVALIDA';
  end if;
  -- A mensagem denunciada precisa ser da pessoa denunciada
  if v_msg is not null and not exists (select 1 from mensagem where id = v_msg and remetente_id = p_denunciado) then
    v_msg := null;
  end if;

  insert into denuncia (denunciante_id, denunciado_id, motivo, descricao, mensagem_id, status)
  values (auth.uid(), p_denunciado, p_motivo, nullif(btrim(coalesce(p_descricao, '')), ''), v_msg, 'em_analise');

  -- RN-016: 3 denúncias de pessoas diferentes em 30 dias suspendem a conta até a moderação.
  -- A conta suspensa some da descoberta (buscar_parceiros e perfil_publico já filtram status = 'ativo').
  select count(distinct denunciante_id) into v_qtd
    from denuncia
   where denunciado_id = p_denunciado
     and criado_em > now() - interval '30 days';
  if v_qtd >= 3 then
    update usuario set status = 'suspenso' where id = p_denunciado and status = 'ativo';
  end if;
end;
$$;

-- ---------- Permissões: só usuários logados ----------
do $$
declare f text;
begin
  foreach f in array array[
    'public.bloqueados_entre(uuid, uuid)',
    'public.pode_conversar(uuid)',
    'public.listar_conexoes()',
    'public.conversa(uuid)',
    'public.enviar_mensagem(uuid, text, uuid)',
    'public.marcar_lidas(uuid)',
    'public.desfazer_conexao(uuid)',
    'public.bloquear_usuario(uuid)',
    'public.desbloquear_usuario(uuid)',
    'public.listar_bloqueados()',
    'public.denunciar(uuid, text, text, uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- ---------- Realtime (RNF-004) ----------
do $$
begin
  alter publication supabase_realtime add table public.mensagem;
exception when duplicate_object then null;
end $$;
