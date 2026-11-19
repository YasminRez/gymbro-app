-- US-22: o app identifica a academia pelo placeId ("osm:node/123" ou "gymbro:<uuid>").
-- Esta função traduz para o id e chama ranking_semanal (0013), que confere o vínculo.
create or replace function public.ranking_semanal_place(p_place text default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select public.ranking_semanal(
    case when p_place is null then null
         when p_place like 'gymbro:%' then (select id from academia where id::text = substr(p_place, 8))
         else (select id from academia where place_id = p_place) end);
$$;
revoke execute on function public.ranking_semanal_place(text) from public, anon;
grant execute on function public.ranking_semanal_place(text) to authenticated;
