-- US-21: notificações chegam em tempo real (badge do sino e aviso local no app aberto).
-- A política "proprias notificacoes" (0005) garante que cada um só recebe as suas.
do $$ begin
  alter publication supabase_realtime add table public.notificacao;
exception when duplicate_object then null; end $$;
