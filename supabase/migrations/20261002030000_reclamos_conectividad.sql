-- Registro de reclamos de conectividad: cada FED registra el que armó y mandó por mail al CED ("Reclamo enviado"); el CED anota después
-- el N° de ticket (PBA) o de incidencia (Educar) que llega de Nivel Central y si se resolvió. Reemplaza la planilla manual del CED.
create table if not exists public.reclamos_conectividad (
  id uuid primary key default gen_random_uuid(),
  fed_id uuid references public.feds(id) on delete set null,
  school_id uuid references public.establecimientos(id) on delete set null,
  -- Se conserva aunque la escuela se quite de la base.
  cue integer,
  tipo text not null,
  tipo_label text not null,
  -- Tipo de conexión de la escuela al momento del reclamo (ej.: "Piso PNCE y Enlace PBA").
  conexion text,
  asunto text not null,
  enviado_at timestamptz not null default now(),
  estado text not null default 'enviado' check (estado in ('enviado', 'en_proceso', 'resuelto', 'anulado')),
  nro_incidencia text,
  notas text,
  resuelto_at timestamptz,
  origen text not null default 'app' check (origen in ('app', 'planilla')),
  actualizado_por uuid references public.feds(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists reclamos_conectividad_escuela on public.reclamos_conectividad (school_id);
create index if not exists reclamos_conectividad_estado on public.reclamos_conectividad (estado, enviado_at desc);
create index if not exists reclamos_conectividad_fed on public.reclamos_conectividad (fed_id);
-- Sólo la usa el servidor (clave de servicio): sin políticas, nadie más la ve.
alter table public.reclamos_conectividad enable row level security;
