-- Eventos DTE (JED, jornadas, encuentros regionales): los carga administración, aparecen en el calendario de todos
-- y cada FED registra su participación (se le crea una acción "EVENTO DTE" vinculada).
-- Formación interna: capacitaciones que el equipo recibe o dicta dentro de la DTE (institucional, no suma a pedagógicas).

alter type agenda_accion add value if not exists 'EVENTO DTE';
alter type agenda_accion add value if not exists 'FORMACIÓN INTERNA';

create table if not exists public.eventos_dte (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(trim(nombre)) > 0),
  fechas date[] not null check (cardinality(fechas) between 1 and 10),
  hora_inicio time,
  hora_fin time,
  modalidad text not null check (modalidad in ('Presencial', 'Virtual', 'Híbrido')),
  lugar text,
  enlace text,
  descripcion text,
  creado_por uuid references public.feds(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.eventos_dte enable row level security;
create index if not exists eventos_dte_fechas_idx on public.eventos_dte using gin (fechas);

-- Participación: la acción del FED apunta al evento (una por FED y fecha).
alter table public.agenda_items add column if not exists evento_id uuid references public.eventos_dte(id) on delete set null;
create unique index if not exists agenda_items_evento_fed_fecha_idx on public.agenda_items (evento_id, fed_id, fecha) where evento_id is not null;

-- Datos de la formación interna.
alter table public.agenda_items add column if not exists modalidad text check (modalidad is null or modalidad in ('Presencial', 'Virtual', 'Híbrido'));
alter table public.agenda_items add column if not exists rol_formacion text check (rol_formacion is null or rol_formacion in ('Asistí', 'La dicté'));
alter table public.agenda_items add column if not exists dictada_por text;

-- Aviso en la campana cuando se carga un evento.
alter table public.notificaciones add column if not exists evento_id uuid references public.eventos_dte(id) on delete cascade;
alter table public.notificaciones drop constraint if exists notificaciones_tipo_check;
alter table public.notificaciones add constraint notificaciones_tipo_check check (tipo = any (array['etiqueta', 'modificacion', 'cancelacion', 'respuesta', 'evento']));
