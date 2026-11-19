-- =====================================================================
-- GymBrô — 10 perfis de TESTE (versão 2, Sprint 6)
-- Só para desenvolvimento. Rode no SQL Editor do Supabase (como administrador):
--
--   select criar_perfis_teste_v2(array['conta1@email.com', 'conta2@email.com']);
--   select apagar_perfis_teste();   -- remove todos os perfis @teste.gymbro.app
--
-- Os perfis do grupo 1 vão para a academia principal da 1ª conta; os do grupo 2,
-- para a da 2ª (se só passar uma conta, todos vão para ela).
-- Fotos: avatares ilustrados (DiceBear) e imagens aleatórias (Picsum). Nada de
-- pessoas reais. Nomes, bios e conversas são inventados.
--
-- O que cada conta ganha para testar:
--   • perfis na descoberta, com horários e interesses variados;
--   • 2 perfis que já curtiram você (curtir de volta = "É um match!");
--   • publicações dos últimos dias no feed "Minha academia", com curtidas e comentários;
--   • 1 conexão com conversa (conta 1 também recebe um convite para treinar amanhã).
-- =====================================================================

create or replace function public.criar_perfis_teste_v2(p_emails text[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contas uuid[] := '{}';
  v_academias uuid[] := '{}';
  v_uid uuid; v_acad uuid; v_id uuid; v_dono uuid; v_g int;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_criados int := 0; v_posts int := 0;
  v_ids jsonb := '{}'::jsonb;
  v_pub uuid; v_con uuid;
  r record; e text; i int;
begin
  foreach e in array p_emails loop
    select id into v_uid from auth.users where email = lower(trim(e));
    if v_uid is null then raise exception 'Usuário % não encontrado', e; end if;
    select academia_id into v_acad from usuario_academia where usuario_id = v_uid and tipo = 'principal';
    if v_acad is null then raise exception 'A conta % ainda não tem academia principal', e; end if;
    v_contas := v_contas || v_uid; v_academias := v_academias || v_acad;
  end loop;

  for r in
    select * from (values
      -- slug, nome, nascimento, gênero, nível, bio, modalidades, objetivos, interesses, horários, grupo, curtiu, modalidade dos posts, legendas
      ('marina',  'Marina Costa',     '1999-04-12', 'Mulher', 'intermediario', 'Treino às 7h antes do trabalho. Curto treino de inferiores e corrida no fim de semana. Bora combinar?', array['Musculação','Cardio'], array['Hipertrofia','Condicionamento'], array['Corrida','Nutrição','Música','Trilha'], array['1-manha','2-manha','3-manha','4-manha','5-manha'], 1, false, 'Musculação', array['Perna em dia 🦵 agachamento subiu 5 kg', 'Corridinha de 5 km pra fechar a semana']),
      ('rafael',  'Rafael Nunes',     '1995-08-03', 'Homem',  'avancado',      'Powerlifting e um pouco de calistenia. Se precisar de ajuda com a técnica do terra, é só chamar.', array['Musculação','Calistenia'], array['Força'], array['Powerlifting','Suplementação','Games','Sono'], array['1-noite','3-noite','5-noite'], 1, true, 'Musculação', array['Terra 180 kg 🔥 meta do mês batida', 'Dia de costas e barra fixa']),
      ('juliana', 'Juliana Prado',    '2001-11-22', 'Mulher', 'iniciante',     'Comecei há 2 meses e quero parceira pra não faltar. Prefiro treinar no fim da tarde.', array['Funcional','Musculação'], array['Emagrecimento','Saúde e bem-estar'], array['Yoga','Pets','Séries','Cozinhar'], array['1-tarde','2-tarde','4-tarde'], 1, true, 'Funcional', array['Primeira semana completa! 💪', 'Funcional pesado hoje, mas fui até o fim']),
      ('thiago',  'Thiago Alves',     '1993-02-14', 'Homem',  'intermediario', 'Crossfit 4x por semana. Gosto de treinar em dupla pra puxar o ritmo.', array['Crossfit','Funcional'], array['Condicionamento','Definição'], array['HIIT','Futebol','Corrida','Tecnologia'], array['1-manha','3-manha','6-manha'], 1, false, 'Crossfit', array['WOD de hoje: 21-15-9 thruster + pull-up', 'Box cheio às 6h, energia lá em cima']),
      ('beatriz', 'Beatriz Lopes',    '1997-06-30', 'Mulher', 'avancado',      'Fisiculturismo natural, foco em glúteos e ombros. Dieta flexível e muito sono 😴', array['Musculação'], array['Hipertrofia','Definição'], array['Fisiculturismo','Dieta flexível','Sono','Mobilidade'], array['1-noite','2-noite','3-noite','4-noite'], 1, false, 'Musculação', array['Ombro e glúteo, combo do dia', 'Off season rendendo']),
      ('lucas',   'Lucas Ferreira',   '2000-01-09', 'Homem',  'iniciante',     'Voltando depois de uma lesão no joelho. Treino leve, sem pressa, mas todo dia.', array['Musculação','Pilates'], array['Saúde e bem-estar'], array['Ciclismo','Alongamento','Meditação','Viagens'], array['6-tarde','0-tarde'], 1, false, 'Pilates', array['Fisioterapia + pilates, joelho agradece', 'Bike leve de 30 min']),
      ('camila',  'Camila Ribeiro',   '1998-09-18', 'Mulher', 'intermediario', 'Spinning e musculação. Procuro alguém pra treinar de manhã e tomar um café depois ☕', array['Spinning','Musculação'], array['Condicionamento','Emagrecimento'], array['Ciclismo','Música','Viagens','Nutrição'], array['2-manha','4-manha','6-manha'], 2, false, 'Spinning', array['Aula de spinning às 7h, suei tudo', 'Superior + abdômen']),
      ('gabriel', 'Gabriel Martins',  '1996-12-05', 'Homem',  'avancado',      'Treino há 8 anos, hoje mais focado em força. Topo dividir treino de peito e costas.', array['Musculação'], array['Força','Hipertrofia'], array['Powerlifting','Basquete','Games','Suplementação'], array['1-noite','2-noite','4-noite'], 2, true, 'Musculação', array['Supino 120 kg, recorde pessoal!', 'Costas e bíceps pra fechar a semana']),
      ('larissa', 'Larissa Gomes',    '2002-03-27', 'Mulher', 'iniciante',     'Lutas e funcional. Quero ganhar condicionamento pra correr minha primeira prova de 10 km.', array['Lutas','Funcional'], array['Condicionamento'], array['Corrida','Vôlei','Música','Pets'], array['1-tarde','3-tarde','5-tarde'], 2, true, 'Lutas', array['Muay thai hoje, canela roxa mas feliz', 'Treino de cardio pra prova de 10 km']),
      ('pedro',   'Pedro Henrique',   '1991-07-11', 'Homem',  'intermediario', 'Calistenia na praça e musculação na academia. Sempre aberto a aprender movimentos novos.', array['Calistenia','Musculação'], array['Força','Definição'], array['Trilha','Natação','Mobilidade','Tecnologia'], array['6-manha','0-manha','3-noite'], 2, false, 'Calistenia', array['Primeira muscle-up limpa 🎉', 'Treino de mobilidade + parada de mão'])
    ) as t(slug, nome, nasc, genero, nivel, bio, modalidades, objetivos, interesses, slots, grupo, curtiu, mod_post, legendas)
  loop
    if exists (select 1 from auth.users where email = r.slug || '@teste.gymbro.app') then continue; end if;
    v_g := least(r.grupo, array_length(v_contas, 1));
    v_dono := v_contas[v_g]; v_acad := v_academias[v_g];
    v_id := gen_random_uuid();
    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at, email_confirmed_at)
    values (v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', r.slug || '@teste.gymbro.app',
            jsonb_build_object('nome', r.nome, 'data_nascimento', r.nasc, 'termos_versao', '1.0'), now(), now(), now());
    update usuario set bio = r.bio, genero = r.genero, nivel = r.nivel where id = v_id;

    -- 3 fotos: avatar ilustrado + 2 imagens aleatórias
    insert into foto_perfil (usuario_id, url, ordem) values
      (v_id, 'https://api.dicebear.com/9.x/notionists/png?size=800&backgroundColor=1b1b1b,252525,2a1716,16241c&seed=' || r.slug, 1),
      (v_id, 'https://picsum.photos/seed/gymbro-' || r.slug || '-2/800/1000', 2),
      (v_id, 'https://picsum.photos/seed/gymbro-' || r.slug || '-3/800/1000', 3);
    insert into usuario_modalidade select v_id, id from modalidade where nome = any (r.modalidades);
    insert into usuario_objetivo select v_id, id from objetivo where nome = any (r.objetivos);
    insert into usuario_interesse select v_id, id from interesse where nome = any (r.interesses);
    insert into disponibilidade (usuario_id, dia_semana, periodo)
      select v_id, split_part(s, '-', 1)::int, split_part(s, '-', 2) from unnest(r.slots) s;
    insert into usuario_academia (usuario_id, academia_id, tipo, desde) values (v_id, v_acad, 'principal', current_date - 30);

    -- Check-ins dos últimos dias (sequência variada) + 2 publicações recentes com legenda
    for i in 1 .. 3 + (abs(hashtext(r.slug)) % 9) loop
      insert into publicacao (usuario_id, academia_id, modalidade_id, foto_url, legenda, duracao_min,
                              data_referencia, conta_para_sequencia, visibilidade, criado_em)
      values (v_id, v_acad, (select id from modalidade where nome = r.mod_post),
              'https://picsum.photos/seed/gymbro-treino-' || r.slug || '-' || i || '/800/1000',
              case when i <= 2 then r.legendas[i] else null end,
              (array[45, 60, 75, 90])[1 + (i % 4)],
              v_hoje - i + 1, true, 'academia_conexoes',
              ((v_hoje - i + 1) + time '07:00' + ((abs(hashtext(r.slug)) % 12) || ' hours')::interval) at time zone 'America/Sao_Paulo');
      v_posts := v_posts + 1;
    end loop;
    perform public.recalcular_estatistica(v_id);

    if r.curtiu then
      insert into curtida (origem_id, destino_id, tipo) values (v_id, v_dono, 'curtir') on conflict do nothing;
    end if;
    v_ids := v_ids || jsonb_build_object(r.slug, v_id);
    v_criados := v_criados + 1;
  end loop;

  -- Curtidas e comentários entre os perfis de teste (feed com movimento)
  insert into curtida_publicacao (usuario_id, publicacao_id)
  select u.id, p.id
    from publicacao p
    join auth.users au on au.id = p.usuario_id and au.email like '%@teste.gymbro.app'
    join auth.users ux on ux.email like '%@teste.gymbro.app' and ux.id <> p.usuario_id
    join usuario u on u.id = ux.id
   where p.legenda is not null and abs(hashtext(p.id::text || u.id::text)) % 3 = 0
  on conflict do nothing;
  insert into comentario (publicacao_id, usuario_id, texto)
  select p.id, (v_ids->>'thiago')::uuid, 'Monstro! Bora junto semana que vem? 💪'
    from publicacao p where p.usuario_id = (v_ids->>'rafael')::uuid and p.legenda is not null limit 1;
  insert into comentario (publicacao_id, usuario_id, texto)
  select p.id, (v_ids->>'beatriz')::uuid, 'Que evolução! Parabéns 👏'
    from publicacao p where p.usuario_id = (v_ids->>'juliana')::uuid and p.legenda is not null limit 1;

  -- Conta 1: conexão com Marina, conversa e convite para treinar amanhã às 7h
  if v_ids ? 'marina' then
    insert into conexao (usuario1_id, usuario2_id, criado_em)
    values (least(v_contas[1], (v_ids->>'marina')::uuid), greatest(v_contas[1], (v_ids->>'marina')::uuid), now() - interval '2 days')
    returning id into v_con;
    insert into mensagem (conexao_id, remetente_id, conteudo, enviada_em, lida_em) values
      (v_con, (v_ids->>'marina')::uuid, 'Oi! Vi que você também treina no Sesc 😄', now() - interval '47 hours', now() - interval '46 hours'),
      (v_con, v_contas[1], 'Oii! Treino sim, geralmente de manhã', now() - interval '46 hours', now() - interval '45 hours'),
      (v_con, (v_ids->>'marina')::uuid, 'Perfeito, eu vou às 7h. Bora fazer perna juntas?', now() - interval '3 hours', null),
      (v_con, (v_ids->>'marina')::uuid, 'Te mandei um convite aqui pelo app 🏋️', now() - interval '2 hours', null);
    insert into convite_treino (conexao_id, remetente_id, destinatario_id, academia_id, modalidade_id, inicio, mensagem)
    values (v_con, (v_ids->>'marina')::uuid, v_contas[1], v_academias[1], (select id from modalidade where nome = 'Musculação'),
            ((v_hoje + 1) + time '07:00') at time zone 'America/Sao_Paulo', 'Bora pegar pesado na perna?');
    insert into notificacao (usuario_id, tipo, referencia_id, origem_id)
    select v_contas[1], 'convite', id, (v_ids->>'marina')::uuid from convite_treino where conexao_id = v_con;
  end if;

  -- Conta 2: conexão com Camila e uma conversa curta
  if v_ids ? 'camila' and array_length(v_contas, 1) >= 2 then
    insert into conexao (usuario1_id, usuario2_id, criado_em)
    values (least(v_contas[2], (v_ids->>'camila')::uuid), greatest(v_contas[2], (v_ids->>'camila')::uuid), now() - interval '1 day')
    returning id into v_con;
    insert into mensagem (conexao_id, remetente_id, conteudo, enviada_em, lida_em) values
      (v_con, (v_ids->>'camila')::uuid, 'Oi! Você faz spinning também?', now() - interval '20 hours', null);
  end if;

  return jsonb_build_object('perfis', v_criados, 'publicacoes', v_posts);
end;
$$;

revoke execute on function public.criar_perfis_teste_v2(text[]) from public, anon, authenticated;
