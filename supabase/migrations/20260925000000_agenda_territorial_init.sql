-- Aplicada al proyecto supabase-sigte-DB (jylmhpxcyrhbhxpvuwsu).
-- Las escuelas se leen de la tabla existente bitacora_pp.schools (no se duplican).
create type public.agenda_accion as enum ('VISITA TÉCNICA','VISITA PEDAGÓGICA','REUNIÓN','CLUB DE TECNOLOGÍA','PRÁCTICAS PROFESIONALIZANTES','TALLER/CAPACITACIÓN','ASISTENCIA REMOTA','CONECTIVIDAD','ADMINISTRATIVO','CHECKLIST','OFICINA R1','PARO');
create type public.agenda_estado as enum ('planificada','realizada','reprogramada','cancelada');

create table public.feds (
  id uuid primary key default gen_random_uuid(),
  nombre_completo text not null,
  distritos_a_cargo text[] not null default '{}'
);

create table public.agenda_items (
  id uuid primary key default gen_random_uuid(),
  fed_id uuid not null references public.feds(id) on delete cascade,
  school_id uuid references bitacora_pp.schools(id) on delete set null,
  fecha date not null,
  hora_inicio time,
  hora_fin time,
  accion public.agenda_accion not null,
  sub_accion text,
  detalle text,
  estado public.agenda_estado not null default 'planificada',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index agenda_items_fed_fecha_idx on public.agenda_items (fed_id, fecha);
create index agenda_items_fecha_idx on public.agenda_items (fecha);
create index agenda_items_school_idx on public.agenda_items (school_id);

create or replace function public.agenda_items_set_updated_at() returns trigger
language plpgsql set search_path = '' as $$ begin new.updated_at = now(); return new; end $$;
create trigger agenda_items_updated_at before update on public.agenda_items
  for each row execute function public.agenda_items_set_updated_at();

-- Acceso sólo desde el servidor (service role); sin políticas para anon/authenticated.
alter table public.feds enable row level security;
alter table public.agenda_items enable row level security;
