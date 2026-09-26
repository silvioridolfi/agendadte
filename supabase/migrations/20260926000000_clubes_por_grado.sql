-- Cada grado (o grado + sección) es un club en sí mismo, aunque compartan escuela.
-- Las propuestas dictadas dentro del club (ej.: taller de redes sociales) quedan como encuentros del club.
alter table public.clubes add column if not exists grupo text;

-- Reconstrucción de los clubes importados (todavía no hay clubes creados desde la app).
update public.agenda_encuentros set club_id = null, es_cierre = false where origen = 'planilla';
delete from public.clubes;

create temp table enc_g on commit drop as
select e.id, e.fed_id, e.school_id, e.lugar, e.fecha, e.encuentro_n, e.descripcion,
  coalesce(
    (select m[1] || '°' || coalesce(' ' || upper(m[2]), '') from regexp_match(e.destinatarios, '([1-7])\s*°(?:\s*([A-Da-d])\M)?') m),
    (select m[1] || '°' from regexp_match(e.descripcion, '(?i)\m([1-7])\s*(?:°|º|to|er|ero|do|ro|mo|vo)?\.?\s*(?:grado|año|ano)\M') m)
  ) as grupo
from public.agenda_encuentros e
where e.tipo = 'CLUB DE TECNOLOGÍA';

-- Sin grado en una escuela con grados: el del mismo día o, si no hay, el de la fecha más cercana.
update enc_g u set grupo = (
  select g.grupo from enc_g g
  where g.grupo is not null and g.fed_id = u.fed_id and g.school_id is not distinct from u.school_id and g.lugar is not distinct from u.lugar
  order by abs(g.fecha - u.fecha), g.grupo limit 1)
where u.grupo is null;

insert into public.clubes (fed_id, school_id, lugar, grupo, fecha_inicio, encuentros_previstos)
select fed_id, school_id, lugar, grupo, min(fecha), 8
from enc_g group by fed_id, school_id, lugar, grupo;

update public.agenda_encuentros e set club_id = c.id
from enc_g g, public.clubes c
where e.id = g.id and c.fed_id = g.fed_id and c.school_id is not distinct from g.school_id
  and c.lugar is not distinct from g.lugar and c.grupo is not distinct from g.grupo;

-- Encuentros previstos: al menos 8 (documento marco) o el número de encuentro más alto registrado.
update public.clubes c set encuentros_previstos = greatest(8, coalesce((select max(encuentro_n) from public.agenda_encuentros where club_id = c.id), 0));

-- Cierre: último registro del club con mención de cierre / último encuentro / diplomas.
with k as (
  select club_id, max(fecha) cierre, (select max(fecha) from public.agenda_encuentros x where x.club_id = e.club_id) fin
  from public.agenda_encuentros e
  where club_id is not null and descripcion ~* '(cierre|diploma|[uú]ltimo encuentro|finalizaci[oó]n)' and descripcion !~* 'preparaci[oó]n para el cierre'
  group by club_id
)
update public.clubes c set fecha_cierre = k.cierre from k where k.club_id = c.id and k.cierre = k.fin;

-- Acto de cierre de toda la escuela (sin grado): cierra todos los clubes de esa escuela que ya no tuvieron encuentros después.
update public.clubes c set fecha_cierre = a.fecha
from (select distinct fed_id, school_id, fecha from public.agenda_encuentros
      where tipo = 'CLUB DE TECNOLOGÍA' and descripcion ~* 'acto de cierre') a
where c.fed_id = a.fed_id and c.school_id = a.school_id and c.fecha_cierre is null
  and not exists (select 1 from public.agenda_encuentros x where x.club_id = c.id and x.fecha > a.fecha);

update public.agenda_encuentros e set es_cierre = true
from public.clubes c where e.club_id = c.id and e.fecha = c.fecha_cierre;
