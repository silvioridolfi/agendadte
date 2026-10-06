-- Búsqueda de escuelas más precisa: cuando el pedido empieza con una sigla ("ees 31", "ep 4", "eest 1", "cens 451") devuelve sólo las escuelas
-- de ese tipo y con ese número propio. Antes "ees 1" traía también las técnicas y las agrarias N° 1 y las que sólo mencionaban "N° 1" más adelante
-- ("N° 5 - Extensión N° 1"). Las extensiones y anexos de la escuela pedida se siguen mostrando, al final.
-- Sin sigla (nombre, localidad, CUE) todo sigue igual, salvo que ahora también se busca por distrito.
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
        when 'cfp' then 'formacion' when 'dte' then 'tecnologia' else w end) filter (where w <> '' and w not in ('n', 'nro', 'no', 'numero', 'de', 'la', 'el')) ws,
      array_agg(w) filter (where w <> '' and w not in ('n', 'nro', 'no', 'numero', 'de', 'la', 'el')) crudas
    from unnest(regexp_split_to_array(lower(unaccent(trim(q))), '[^a-z0-9]+')) w
  ), sig(k, p, numerada) as (values
    ('ees', 'escuela de educacion secundaria', true), ('sec', 'escuela (de educacion )?secundaria', true), ('es', 'escuela secundaria', true),
    ('eest', 'escuela de educacion secundaria tecnica', true), ('est', 'escuela de educacion secundaria tecnica', true), ('tec', 'escuela de educacion secundaria tecnica', true),
    ('eesa', 'escuela de educacion secundaria agraria', true),
    ('ep', 'escuela (de educacion )?primaria', true), ('eep', 'escuela (de educacion )?primaria', true), ('prim', 'escuela (de educacion )?primaria', true),
    ('ji', 'jardin de infantes( rural( de matricula minima)?)?', true), ('jim', 'jardin maternal', true),
    ('eee', 'escuela (de educacion )?(especial|estetica)', true), ('esp', 'escuela especial', true), ('eepa', 'escuela de adultos', true),
    ('cfp', 'centro de formacion profesional', true), ('isfd', 'instituto superior de formacion docente', true), ('isfdyt', 'instituto superior de formacion docente y tecnica', true),
    ('isft', 'instituto superior de formacion tecnica', true), ('cef', 'centro de educacion fisica', true), ('cea', 'centro de educacion agricola', true),
    ('cept', 'centro educativo para la produccion total', true), ('cens', 'centro educativo (de )?nivel secundario', true),
    ('cec', 'centro educativo complementario', true), ('cie', 'centro (de )?investigacion educativa', true), ('dte', 'direccion de tecnologia educativa', false)
  ), m as (
    -- La sigla del pedido (la primera que aparezca), el número propio pedido y las demás palabras.
    select s.p, s.numerada, s.k,
      (select w from unnest(t.crudas) w where w ~ '^[0-9]{1,4}$' limit 1) num,
      (select array_agg(w) from unnest(t.ws) w where w !~ '^[0-9]+$' and w <> (case s.k when 'eest' then 'tecnica' when 'est' then 'tecnica' when 'tec' then 'tecnica' when 'ees' then 'secundaria' when 'sec' then 'secundaria' when 'ep' then 'primaria' when 'eep' then 'primaria' when 'prim' then 'primaria' when 'ji' then 'jardin' when 'jim' then 'jardin' when 'eee' then 'especial' when 'esp' then 'especial' when 'cfp' then 'formacion' when 'dte' then 'tecnologia' else s.k end)) otras
    from t cross join lateral (select * from sig where k = any(t.crudas) order by array_position(t.crudas, k) limit 1) s
  ), e as (
    select e.*, lower(unaccent(coalesce(e.nombre,''))) nom,
      lower(unaccent(coalesce(e.nombre,'') || ' ' || coalesce(e.ciudad,'') || ' ' || coalesce(e.distrito,''))) txt from public.establecimientos e
  )
  select e.id, e.cue, e.nombre, e.distrito, e.ciudad
  from e cross join t left join m on true
  where cardinality(t.ws) > 0 and (
    case when m.p is not null then
      e.nom ~ ('^((extension|anexo)( n?[°º.]? ?[0-9]+| i{1,3})? (de|del) (la )?)?' || m.p
        || case when m.numerada then '\s+(n[°º.]?\s*)?' || coalesce(m.num || '([^0-9]|$)', '[0-9]') else '(\s|$)' end)
      and not exists (select 1 from unnest(m.otras) w where e.txt not like '%' || w || '%')
    else
      (cardinality(t.ws) = 1 and t.ws[1] ~ '^\d{4,}$' and e.cue::text like t.ws[1] || '%')
      or not exists (
        select 1 from unnest(t.ws) w
        where case when w ~ '^\d+$' then e.txt !~ ('(^|[^0-9])' || w || '([^0-9]|$)') else e.txt not like '%' || w || '%' end)
    end)
  order by (e.nom ~ ('n. ?' || coalesce((select w from unnest(t.ws) w where w ~ '^\d+$' limit 1), '-') || '([^0-9]|$)')) desc,
    (e.nom like 'anexo%' or e.nom like 'extension%'), e.nombre
  limit max_results
$$;
revoke execute on function public.search_establecimientos(text, int) from public, anon, authenticated;
grant execute on function public.search_establecimientos(text, int) to service_role;
