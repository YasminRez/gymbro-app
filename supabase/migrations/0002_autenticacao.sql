-- GymBrô — Sprint 1: autenticação (US-01, US-02, US-03)
-- Rode depois do 0001_schema_inicial.sql (SQL Editor > New query > Run).

-- ------------------------------------------------------------------
-- US-01 / RN-004 / RN-005: ao criar o usuário no Supabase Auth, cria o
-- registro em "usuario" e o aceite dos termos com os dados enviados pelo app.
-- Se a idade for menor que 18, o CHECK de usuario.data_nascimento barra
-- o cadastro também no servidor.
-- ------------------------------------------------------------------
create or replace function public.criar_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usuario (id, nome, data_nascimento)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', ''),
    (new.raw_user_meta_data ->> 'data_nascimento')::date
  );

  if new.raw_user_meta_data ? 'termos_versao' then
    insert into public.aceite_termos (usuario_id, versao)
    values (new.id, new.raw_user_meta_data ->> 'termos_versao');
  end if;

  return new;
end;
$$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_usuario();

-- ------------------------------------------------------------------
-- RN-023: 5 tentativas inválidas seguidas bloqueiam o e-mail por 5 minutos.
-- (O Supabase Auth também tem limite de requisições próprio.)
-- ------------------------------------------------------------------
create table if not exists public.tentativa_login (
  email varchar primary key,
  falhas int not null default 0,
  bloqueado_ate timestamptz
);
alter table public.tentativa_login enable row level security; -- só acessível pelas funções abaixo

create or replace function public.login_bloqueado_ate(p_email text)
returns timestamptz
language sql
security definer
set search_path = public
as $$
  select bloqueado_ate from tentativa_login
  where email = lower(trim(p_email)) and bloqueado_ate > now();
$$;

create or replace function public.registrar_tentativa_login(p_email text, p_sucesso boolean)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_falhas int;
  v_bloqueio timestamptz;
begin
  if p_sucesso then
    delete from tentativa_login where email = v_email;
    return null;
  end if;

  insert into tentativa_login as t (email, falhas)
  values (v_email, 1)
  on conflict (email) do update
    set falhas = case when t.bloqueado_ate is not null and t.bloqueado_ate <= now() then 1 else t.falhas + 1 end,
        bloqueado_ate = case when t.bloqueado_ate is not null and t.bloqueado_ate <= now() then null else t.bloqueado_ate end
  returning falhas into v_falhas;

  if v_falhas >= 5 then
    v_bloqueio := now() + interval '5 minutes';
    update tentativa_login set bloqueado_ate = v_bloqueio where email = v_email;
  end if;

  return v_bloqueio;
end;
$$;

grant execute on function public.login_bloqueado_ate(text) to anon, authenticated;
grant execute on function public.registrar_tentativa_login(text, boolean) to anon, authenticated;

-- ------------------------------------------------------------------
-- RN-005: o próprio usuário registra o aceite de novas versões dos termos
-- (a política "proprio aceite" do 0001 já libera insert/select do próprio registro).
-- ------------------------------------------------------------------
