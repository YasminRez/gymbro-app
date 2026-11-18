-- GymBrô — ajuste de segurança apontado pelo Security Advisor do Supabase.
-- Por padrão o Postgres libera EXECUTE de funções para todos (PUBLIC/anon).
-- Aqui cada função fica liberada só para quem precisa.

-- Função de trigger: ninguém chama pela API
revoke execute on function public.criar_usuario() from public, anon, authenticated;

-- Só usuários logados
revoke execute on function public.salvar_perfil(jsonb) from public, anon;
revoke execute on function public.definir_academia(text, text, text, double precision, double precision, text) from public, anon;
revoke execute on function public.sugerir_academia(text, text, double precision, double precision) from public, anon;
revoke execute on function public.contar_usuarios_academias(text[]) from public, anon;

-- login_bloqueado_ate e registrar_tentativa_login continuam liberadas para anon
-- de propósito: são chamadas na tela Entrar, antes de existir sessão (RN-023).
