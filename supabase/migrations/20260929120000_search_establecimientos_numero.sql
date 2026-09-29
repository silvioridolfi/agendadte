-- Búsqueda más natural: un número suelto busca el N° exacto de la escuela (o prefijo de CUE);
-- siglas y palabras comunes (eest, técnica, ji, jardín, eee, especial, ep, ees...) se traducen;
-- los números junto a palabras deben coincidir completos ("tecnica 6" no trae la 16 ni la 60).
create or replace function public.search_establecimientos(q text, max_results int default 15)
returns table (id uuid, cue integer, nombre text, distrito text, ciudad text)
language sql stable set search_path = public, extensions as $$
  with t as (
    select array_agg(case w
        when 'eest' then 'tecnica' when 'est' then 'tecnica' when 'tec' then 'tecnica'
        when 'ees' then 'secundaria' when 'sec' then 'secundaria'
        when 'ep' then 'primaria' when 'eep' then 'primaria' when 'prim' then 'primaria'
        when 'ji' then 'jardin' when 'jim' then 'jardin'
        when 'eee' then 'especial' when 'esp' then 'especial'
        when 'cfp' then 'formacion' else w end) filter (where w <> '' and w not in ('n', 'nro', 'no', 'numero', 'de', 'la', 'el')) ws
    from unnest(regexp_split_to_array(lower(unaccent(trim(q))), '[^a-z0-9]+')) w
  ), e as (
    select e.*, lower(unaccent(coalesce(e.nombre,'') || ' ' || coalesce(e.ciudad,''))) txt from public.establecimientos e
  )
  select e.id, e.cue, e.nombre, e.distrito, e.ciudad
  from e, t
  where cardinality(t.ws) > 0 and (
    (cardinality(t.ws) = 1 and t.ws[1] ~ '^\d{4,}$' and e.cue::text like t.ws[1] || '%')
    or not exists (
      select 1 from unnest(t.ws) w
      where case when w ~ '^\d+$' then e.txt !~ ('(^|[^0-9])' || w || '([^0-9]|$)') else e.txt not like '%' || w || '%' end))
  order by (e.txt ~ ('n. ?' || coalesce((select w from unnest(t.ws) w where w ~ '^\d+$' limit 1), '-') || '([^0-9]|$)')) desc,
    (lower(e.nombre) like 'anexo%' or lower(e.nombre) like 'extension%') , e.nombre
  limit max_results
$$;
revoke execute on function public.search_establecimientos(text, int) from public, anon, authenticated;
grant execute on function public.search_establecimientos(text, int) to service_role;
