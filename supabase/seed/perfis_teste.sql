-- GymBrô — perfis de TESTE para experimentar a descoberta e o match.
-- Só para desenvolvimento. As funções não ficam liberadas para o app:
-- rode no SQL Editor do Supabase (como administrador).
--
--   select criar_perfis_teste('seu-email@exemplo.com');   -- cria 6 perfis na sua academia principal
--   select apagar_perfis_teste();                         -- remove todos os perfis de teste
--
-- Os perfis usam e-mails @teste.gymbro.app e fotos de placeholder.
-- Dois deles (Ana e Diego) já curtiram você: ao curtir de volta, sai o "É um match!".

create or replace function public.criar_perfis_teste(p_email text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_eu uuid;
  v_academia uuid;
  v_id uuid;
  v_n int := 0;
  r record;
begin
  select id into v_eu from auth.users where email = lower(trim(p_email));
  if v_eu is null then raise exception 'Usuário % não encontrado', p_email; end if;
  select academia_id into v_academia from usuario_academia where usuario_id = v_eu and tipo = 'principal';
  if v_academia is null then raise exception 'Defina sua academia principal no app antes'; end if;

  for r in
    select * from (values
      ('ana',    'Ana Souza',     '2001-05-10', 'Mulher', 'intermediario', 'Treino de perna toda segunda e quinta à noite. Procuro alguém pra dividir o agachamento pesado.', array['Musculação'], array['Hipertrofia','Força'], array['Corrida','Nutrição','Música','Séries'], array['1-noite','3-noite','4-noite'], true),
      ('bruno',  'Bruno Lima',    '1996-02-21', 'Homem',  'avancado',      'Powerlifting há 5 anos. Posso ajudar com técnica de supino e terra.', array['Musculação'], array['Força'], array['Powerlifting','Suplementação','Games'], array['1-manha','3-manha','5-manha'], false),
      ('carla',  'Carla Mendes',  '1994-09-02', 'Mulher', 'iniciante',     'Voltando a treinar depois de um tempo parada. Bora manter a constância!', array['Funcional','Cardio'], array['Emagrecimento','Condicionamento'], array['Yoga','Cozinhar','Pets','Música'], array['2-noite','4-noite'], false),
      ('diego',  'Diego Rocha',   '2003-12-15', 'Homem',  'intermediario', 'Crossfit e calistenia. Sempre no fim da tarde.', array['Crossfit','Calistenia'], array['Condicionamento'], array['HIIT','Futebol','Corrida'], array['1-tarde','2-tarde','3-tarde','4-tarde'], true),
      ('eva',    'Eva Martins',   '1998-07-30', 'Mulher', 'avancado',      'Fisiculturismo natural. Foco total em hipertrofia.', array['Musculação'], array['Hipertrofia','Definição'], array['Fisiculturismo','Dieta flexível','Sono'], array['1-noite','2-noite','3-noite','4-noite','5-noite'], false),
      ('felipe', 'Felipe Araújo', '1990-03-08', 'Homem',  'iniciante',     'Comecei agora, quero alguém pra me cobrar presença.', array['Musculação','Cardio'], array['Saúde e bem-estar'], array['Ciclismo','Viagens','Tecnologia'], array['6-manha','0-manha'], false)
    ) as t(slug, nome, nasc, genero, nivel, bio, modalidades, objetivos, interesses, slots, curtiu)
  loop
    if exists (select 1 from auth.users where email = r.slug || '@teste.gymbro.app') then continue; end if;
    v_id := gen_random_uuid();
    insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at, email_confirmed_at)
    values (v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', r.slug || '@teste.gymbro.app',
            jsonb_build_object('nome', r.nome, 'data_nascimento', r.nasc, 'termos_versao', '1.0'), now(), now(), now());
    update usuario set bio = r.bio, genero = r.genero, nivel = r.nivel where id = v_id;
    insert into foto_perfil (usuario_id, url, ordem)
      values (v_id, 'https://placehold.co/800x1000/1B1B1B/BE5049/png?text=' || replace(split_part(r.nome, ' ', 1), ' ', '+'), 1);
    insert into usuario_modalidade select v_id, id from modalidade where nome = any (r.modalidades);
    insert into usuario_objetivo select v_id, id from objetivo where nome = any (r.objetivos);
    insert into usuario_interesse select v_id, id from interesse where nome = any (r.interesses);
    insert into disponibilidade (usuario_id, dia_semana, periodo)
      select v_id, split_part(s, '-', 1)::int, split_part(s, '-', 2) from unnest(r.slots) s;
    insert into usuario_academia (usuario_id, academia_id, tipo, desde) values (v_id, v_academia, 'principal', current_date - 30);
    insert into estatistica_atividade (usuario_id, total_dias_ativos, sequencia_atual, maior_sequencia)
      values (v_id, (random() * 120)::int + 3, (random() * 20)::int + 1, 25);
    if r.curtiu then
      insert into curtida (origem_id, destino_id, tipo) values (v_id, v_eu, 'curtir');
    end if;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

create or replace function public.apagar_perfis_teste()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_n int;
begin
  with apagados as (delete from auth.users where email like '%@teste.gymbro.app' returning 1)
  select count(*) into v_n from apagados;
  return v_n;
end;
$$;

-- Ninguém chama pelo app
revoke execute on function public.criar_perfis_teste(text) from public, anon, authenticated;
revoke execute on function public.apagar_perfis_teste() from public, anon, authenticated;
