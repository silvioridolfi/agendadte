-- Acciones compartidas: el FED que crea la acción puede etiquetar compañeros ("acompañado por").
-- La acción aparece en el calendario de cada etiquetado y le llega una notificación. Sólo el creador la edita.
create table if not exists public.agenda_participantes (
  item_id uuid not null references public.agenda_items(id) on delete cascade,
  fed_id uuid not null references public.feds(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (item_id, fed_id)
);
create index if not exists agenda_participantes_fed_idx on public.agenda_participantes (fed_id);
alter table public.agenda_participantes enable row level security;

create table if not exists public.notificaciones (
  id uuid primary key default gen_random_uuid(),
  fed_id uuid not null references public.feds(id) on delete cascade,
  item_id uuid references public.agenda_items(id) on delete cascade,
  autor_id uuid references public.feds(id) on delete set null,
  tipo text not null default 'etiqueta' check (tipo in ('etiqueta', 'modificacion')),
  leida boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notificaciones_fed_idx on public.notificaciones (fed_id, leida, created_at desc);
alter table public.notificaciones enable row level security;

-- Coordinación: perfil propio que puede crear acciones (ej.: reuniones de equipo) e invitar a todo el equipo.
-- No suma a las métricas por FED.
alter table public.feds add column if not exists rol text not null default 'fed' check (rol in ('fed', 'coordinacion'));
insert into public.feds (nombre_completo, distritos_a_cargo, rol)
select 'Coordinación Región 1', '{}', 'coordinacion'
where not exists (select 1 from public.feds where rol = 'coordinacion');
