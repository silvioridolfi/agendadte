-- Búsqueda para el autocompletado de la agenda: sin tildes, todas las palabras deben aparecer; o prefijo de CUE.
create or replace function public.search_establecimientos(q text, max_results int default 15)
returns table (id uuid, cue integer, nombre text, distrito text, ciudad text)
language sql stable set search_path = public, extensions as $$
  select e.id, e.cue, e.nombre, e.distrito, e.ciudad
  from public.establecimientos e
  where case when trim(q) ~ '^\d+$' then e.cue::text like trim(q) || '%'
    else not exists (
      select 1 from unnest(regexp_split_to_array(lower(unaccent(trim(q))), '\s+')) w
      where w <> '' and lower(unaccent(coalesce(e.nombre,'') || ' ' || coalesce(e.ciudad,''))) not like '%' || w || '%')
    end
  order by e.nombre
  limit max_results
$$;
revoke execute on function public.search_establecimientos(text, int) from public, anon, authenticated;
grant execute on function public.search_establecimientos(text, int) to service_role;
