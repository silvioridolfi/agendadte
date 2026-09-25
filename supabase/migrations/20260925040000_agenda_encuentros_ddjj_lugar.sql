-- Encuentros (clubes, talleres, prácticas): registro de participación, 1..N por acción o sueltos,
-- como la hoja CAPACITACIONES del master. Las acciones siguen contándose en agenda_items.
create table public.agenda_encuentros (
  id uuid primary key default gen_random_uuid(),
  agenda_item_id uuid references public.agenda_items(id) on delete cascade,
  fed_id uuid not null references public.feds(id) on delete cascade,
  school_id uuid references public.establecimientos(id) on delete set null,
  lugar text,
  fecha date not null,
  tipo public.agenda_accion not null,
  propuesta text,
  encuentro_n integer check (encuentro_n is null or encuentro_n > 0),
  modalidad text check (modalidad is null or modalidad in ('Presencial', 'Virtual')),
  destinatarios text,
  inscriptos integer check (inscriptos is null or inscriptos >= 0),
  asistentes integer check (asistentes is null or asistentes >= 0),
  descripcion text,
  fotos_url text,
  origen text not null default 'app' check (origen in ('app', 'planilla')),
  origen_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index agenda_encuentros_fecha_idx on public.agenda_encuentros (fecha);
create index agenda_encuentros_item_idx on public.agenda_encuentros (agenda_item_id);
create index agenda_encuentros_fed_idx on public.agenda_encuentros (fed_id, fecha);
create unique index agenda_encuentros_origen_ref_idx on public.agenda_encuentros (origen_ref) where origen_ref is not null;
create trigger agenda_encuentros_updated_at before update on public.agenda_encuentros
  for each row execute function public.agenda_items_set_updated_at();
alter table public.agenda_encuentros enable row level security;

-- Los datos de encuentro pasan a la tabla nueva (las columnas estaban vacías).
alter table public.agenda_items
  drop column if exists encuentro_n, drop column if exists propuesta, drop column if exists destinatarios,
  drop column if exists modalidad, drop column if exists inscriptos, drop column if exists asistentes,
  -- Lugar cuando no es una escuela (jefatura distrital, feria, etc.)
  add column if not exists lugar text;

-- DD.JJ. de horarios de cada FED (hoja PERFIL de su planilla).
-- ddjj: [{ "dia": 1..5, "dte": "8 a 17", "dte_desde": "08:00", "dte_hasta": "17:00", "externo": "EP9 12.30 a 17.30hs" }]
alter table public.feds
  add column if not exists carga_horaria text,
  add column if not exists ddjj jsonb not null default '[]'::jsonb;

-- Importación 2026 (una sola vez, 25/09/2026): 1446 acciones y 429 encuentros desde las planillas
-- Registro_<FED> de Drive, con origen = 'planilla' y origen_ref = '<FED>:R<fila>' / '<FED>:C<fila>'.
