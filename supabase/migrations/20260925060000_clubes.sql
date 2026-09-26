-- Clubes de Tecnología (línea prioritaria DTE 2025-2027): cada club tiene inicio, cierre y encuentros previstos.
-- Los encuentros de club se vinculan a su club; el estado "sin actividad" se calcula en la app.
create table public.clubes (
  id uuid primary key default gen_random_uuid(),
  fed_id uuid not null references public.feds(id) on delete cascade,
  school_id uuid references public.establecimientos(id) on delete set null,
  lugar text,
  propuesta text not null default 'Club de Tecnología',
  fecha_inicio date not null,
  fecha_cierre date,
  encuentros_previstos integer check (encuentros_previstos is null or encuentros_previstos > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (fecha_cierre is null or fecha_cierre >= fecha_inicio)
);
create index clubes_fed_idx on public.clubes (fed_id);
alter table public.clubes enable row level security;

alter table public.agenda_encuentros
  add column club_id uuid references public.clubes(id) on delete set null,
  add column tipo_jornada text check (tipo_jornada is null or tipo_jornada in ('Sensibilización', 'Formación', 'Presentación', 'Taller', 'Acompañamiento', 'Otro')),
  add column es_cierre boolean not null default false,
  drop constraint agenda_encuentros_modalidad_check,
  add constraint agenda_encuentros_modalidad_check check (modalidad is null or modalidad in ('Presencial', 'Virtual', 'Híbrido'));
create index agenda_encuentros_club_idx on public.agenda_encuentros (club_id);

-- Carga inicial desde los encuentros importados: un club por FED + escuela (o lugar).
-- Mínimo de 8 encuentros según el documento marco de Clubes 2026.
with g as (
  select fed_id, school_id, lugar, min(fecha) ini, max(fecha) fin, max(encuentro_n) max_n,
    max(fecha) filter (where descripcion ~* '(cierre|diploma|[uú]ltimo encuentro|finalizaci[oó]n)' and descripcion !~* 'preparaci[oó]n para el cierre') cierre
  from public.agenda_encuentros
  where tipo = 'CLUB DE TECNOLOGÍA' and coalesce(propuesta, 'club') ~* 'club'
  group by fed_id, school_id, lugar
)
insert into public.clubes (fed_id, school_id, lugar, fecha_inicio, fecha_cierre, encuentros_previstos)
select fed_id, school_id, lugar, ini, case when cierre = fin then cierre end, greatest(8, coalesce(max_n, 0))
from g;

update public.agenda_encuentros e set club_id = c.id
from public.clubes c
where e.tipo = 'CLUB DE TECNOLOGÍA' and coalesce(e.propuesta, 'club') ~* 'club'
  and c.fed_id = e.fed_id and c.school_id is not distinct from e.school_id and c.lugar is not distinct from e.lugar;

update public.agenda_encuentros e set es_cierre = true
from public.clubes c where e.club_id = c.id and e.fecha = c.fecha_cierre;
