-- GymBrô — Sprint 2: perfil, fotos, academias e preferências (US-04 a US-07)
-- Rode depois do 0002_autenticacao.sql.

-- ------------------------------------------------------------------
-- Catálogos (mesmos nomes de src/constants/catalogos.ts)
-- ------------------------------------------------------------------
insert into modalidade (nome) values
  ('Musculação'), ('Funcional'), ('Crossfit'), ('Cardio'), ('Calistenia'), ('Pilates'), ('Spinning'), ('Lutas')
on conflict (nome) do nothing;

insert into objetivo (nome) values
  ('Hipertrofia'), ('Emagrecimento'), ('Condicionamento'), ('Força'), ('Saúde e bem-estar'), ('Definição')
on conflict (nome) do nothing;

insert into interesse (nome, categoria) values
  ('Corrida','Esportes'), ('Futebol','Esportes'), ('Ciclismo','Esportes'), ('Natação','Esportes'),
  ('Vôlei','Esportes'), ('Basquete','Esportes'), ('Trilha','Esportes'),
  ('Powerlifting','Treino'), ('Fisiculturismo','Treino'), ('Yoga','Treino'), ('Alongamento','Treino'),
  ('HIIT','Treino'), ('Mobilidade','Treino'),
  ('Nutrição','Saúde'), ('Dieta flexível','Saúde'), ('Suplementação','Saúde'), ('Sono','Saúde'), ('Meditação','Saúde'),
  ('Música','Lifestyle'), ('Games','Lifestyle'), ('Séries','Lifestyle'), ('Viagens','Lifestyle'),
  ('Cozinhar','Lifestyle'), ('Pets','Lifestyle'), ('Tecnologia','Lifestyle')
on conflict (nome) do nothing;

-- ------------------------------------------------------------------
-- Políticas de acesso do próprio perfil (RNF-003)
-- ------------------------------------------------------------------
create policy "proprias modalidades" on usuario_modalidade for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy "proprios objetivos" on usuario_objetivo for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy "proprios interesses" on usuario_interesse for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy "propria disponibilidade" on disponibilidade for all to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy "proprios vinculos" on usuario_academia for select to authenticated
  using (usuario_id = auth.uid());
create policy "remover vinculo secundario" on usuario_academia for delete to authenticated
  using (usuario_id = auth.uid() and tipo = 'secundaria');

-- Academias pendentes ficam visíveis para quem sugeriu/vinculou
drop policy if exists "academias aprovadas" on academia;
create policy "academias visiveis" on academia for select to authenticated using (
  status = 'aprovada'
  or exists (select 1 from usuario_academia ua where ua.academia_id = academia.id and ua.usuario_id = auth.uid())
);

-- Campo para saber quem sugeriu a academia (moderação)
alter table academia add column if not exists sugerida_por uuid references usuario (id) on delete set null;

-- ------------------------------------------------------------------
-- US-04 / US-05: salvar o perfil inteiro de uma vez (transação)
-- p = { bio, genero, nivel, fotos: [url], modalidades: [nome], objetivos: [nome],
--       interesses: [nome], disponibilidade: [{dia, periodo}] }
-- ------------------------------------------------------------------
create or replace function public.salvar_perfil(p jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_fotos int := jsonb_array_length(coalesce(p -> 'fotos', '[]'));
  v_interesses int := jsonb_array_length(coalesce(p -> 'interesses', '[]'));
begin
  if v_uid is null then raise exception 'NAO_AUTENTICADO'; end if;
  -- RN-007
  if v_fotos < 1 or v_fotos > 6 then raise exception 'FOTOS_INVALIDAS'; end if;
  if v_interesses < 3 or v_interesses > 10 then raise exception 'INTERESSES_INVALIDOS'; end if;
  if length(coalesce(p ->> 'bio', '')) > 500 then raise exception 'BIO_LONGA'; end if;

  update usuario
     set bio = p ->> 'bio', genero = p ->> 'genero', nivel = p ->> 'nivel'
   where id = v_uid;

  delete from foto_perfil where usuario_id = v_uid;
  insert into foto_perfil (usuario_id, url, ordem)
  select v_uid, f.value #>> '{}', f.ordinality
    from jsonb_array_elements(p -> 'fotos') with ordinality as f;

  delete from usuario_modalidade where usuario_id = v_uid;
  insert into usuario_modalidade (usuario_id, modalidade_id)
  select v_uid, m.id from modalidade m where m.nome in (select jsonb_array_elements_text(p -> 'modalidades'));

  delete from usuario_objetivo where usuario_id = v_uid;
  insert into usuario_objetivo (usuario_id, objetivo_id)
  select v_uid, o.id from objetivo o where o.nome in (select jsonb_array_elements_text(p -> 'objetivos'));

  delete from usuario_interesse where usuario_id = v_uid;
  insert into usuario_interesse (usuario_id, interesse_id)
  select v_uid, i.id from interesse i where i.nome in (select jsonb_array_elements_text(p -> 'interesses'));

  delete from disponibilidade where usuario_id = v_uid;
  insert into disponibilidade (usuario_id, dia_semana, periodo)
  select v_uid, (d ->> 'dia')::int, d ->> 'periodo' from jsonb_array_elements(p -> 'disponibilidade') d;
end;
$$;

-- ------------------------------------------------------------------
-- US-07 / RN-009: vincular academia (principal ou secundária)
-- Erros: JA_PRINCIPAL | AGUARDE_TROCA:<dias> | LIMITE_SECUNDARIAS
-- ------------------------------------------------------------------
create or replace function public.definir_academia(
  p_place_id text, p_nome text, p_endereco text, p_lat double precision, p_lng double precision, p_tipo text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_academia uuid;
  v_principal record;
  v_dias int;
begin
  if v_uid is null then raise exception 'NAO_AUTENTICADO'; end if;
  if p_tipo not in ('principal', 'secundaria') then raise exception 'TIPO_INVALIDO'; end if;

  -- Academias do OpenStreetMap entram no banco como cache (US-06, notas técnicas)
  if p_place_id like 'gymbro:%' then
    v_academia := substring(p_place_id from 8)::uuid;
  else
    insert into academia (nome, endereco, latitude, longitude, place_id, status)
    values (p_nome, p_endereco, p_lat, p_lng, p_place_id, 'aprovada')
    on conflict (place_id) do update set nome = excluded.nome, endereco = excluded.endereco
    returning id into v_academia;
  end if;

  select * into v_principal from usuario_academia where usuario_id = v_uid and tipo = 'principal';

  if v_principal.academia_id = v_academia then raise exception 'JA_PRINCIPAL'; end if;

  if p_tipo = 'principal' then
    if v_principal.academia_id is not null then
      v_dias := 7 - (current_date - v_principal.desde);
      if v_dias > 0 then raise exception 'AGUARDE_TROCA:%', v_dias; end if;
      delete from usuario_academia where usuario_id = v_uid and tipo = 'principal';
    end if;
    delete from usuario_academia where usuario_id = v_uid and academia_id = v_academia;
    insert into usuario_academia (usuario_id, academia_id, tipo) values (v_uid, v_academia, 'principal');
  else
    if (select count(*) from usuario_academia
         where usuario_id = v_uid and tipo = 'secundaria' and academia_id <> v_academia) >= 2 then
      raise exception 'LIMITE_SECUNDARIAS';
    end if;
    insert into usuario_academia (usuario_id, academia_id, tipo) values (v_uid, v_academia, 'secundaria')
    on conflict (usuario_id, academia_id) do nothing;
  end if;

  return v_academia;
end;
$$;

-- US-07, cenário 4: sugerir academia (fica "Em análise") e vincular provisoriamente
create or replace function public.sugerir_academia(
  p_nome text, p_endereco text, p_lat double precision, p_lng double precision
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'NAO_AUTENTICADO'; end if;
  insert into academia (nome, endereco, latitude, longitude, status, sugerida_por)
  values (trim(p_nome), trim(p_endereco), coalesce(p_lat, 0), coalesce(p_lng, 0), 'pendente', auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

-- US-06, cenário 1: quantas pessoas do GymBrô treinam em cada academia
create or replace function public.contar_usuarios_academias(p_place_ids text[])
returns table (place_id text, usuarios bigint)
language sql
security definer
set search_path = public
as $$
  select a.place_id, count(ua.usuario_id)
    from academia a
    join usuario_academia ua on ua.academia_id = a.id
    join usuario u on u.id = ua.usuario_id and u.status = 'ativo'
   where a.place_id = any (p_place_ids)
   group by a.place_id;
$$;

grant execute on function public.salvar_perfil(jsonb) to authenticated;
grant execute on function public.definir_academia(text, text, text, double precision, double precision, text) to authenticated;
grant execute on function public.sugerir_academia(text, text, double precision, double precision) to authenticated;
grant execute on function public.contar_usuarios_academias(text[]) to authenticated;

-- ------------------------------------------------------------------
-- Storage: fotos de perfil (RNF-007). Leitura pública; cada usuário só
-- escreve na própria pasta: fotos-perfil/<uid>/arquivo.jpg
-- ------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos-perfil', 'fotos-perfil', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "fotos: dono envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos-perfil' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "fotos: dono atualiza" on storage.objects for update to authenticated
  using (bucket_id = 'fotos-perfil' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "fotos: dono apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'fotos-perfil' and (storage.foldername(name))[1] = auth.uid()::text);
