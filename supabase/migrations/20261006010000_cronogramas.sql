-- Cronogramas de Nivel Central (pestaña "Cronogramas" del consolidado de conectividad): copia de solo lectura que se sincroniza cada noche,
-- una fila por cronograma y escuela (los que traen dos CUE se separan). Lo que carga el equipo (avisos, "no se realizó"…) va aparte,
-- en cronogramas_seguimiento, para que la sincronización nunca lo pise.
create table if not exists public.cronogramas (
  id uuid primary key default gen_random_uuid(),
  -- Clave natural: número de cronograma + CUE + inicio + tipo (la planilla no tiene un id propio).
  clave text not null unique,
  cue integer not null,
  school_id uuid references public.establecimientos(id) on delete set null,
  fecha_inicio date not null,
  fecha_fin date not null,
  tipo text,
  proveedor text,
  nro text,
  semana text,
  -- Columna ESTADO de la planilla (la completa el equipo a mano): es referencia, no manda sobre el seguimiento de la agenda.
  estado_planilla text,
  -- Nombre y DNI/CUIL de los técnicos (o un enlace): lo necesitan las escuelas para autorizar el ingreso.
  instaladores text,
  descripcion text,
  observaciones text,
  predio text,
  distrito text,
  nombre_planilla text,
  tipo_establecimiento text,
  hash text not null,
  -- false cuando la fila deja de estar en la planilla (se conserva por si ya tenía seguimiento).
  en_planilla boolean not null default true,
  visto_at timestamptz not null default now(),
  primera_vez_at timestamptz not null default now(),
  actualizado_at timestamptz not null default now()
);
create index if not exists cronogramas_fechas on public.cronogramas (fecha_fin, fecha_inicio);
create index if not exists cronogramas_escuela on public.cronogramas (school_id);
create index if not exists cronogramas_cue on public.cronogramas (cue);

-- Estado propio de la agenda (se completa desde la sección Cronogramas): cada cambio es una fila; vale la última.
create table if not exists public.cronogramas_seguimiento (
  id uuid primary key default gen_random_uuid(),
  cronograma_id uuid not null references public.cronogramas(id) on delete cascade,
  estado text not null check (estado in ('jefatura_avisada', 'escuela_avisada', 'realizado', 'no_realizado', 'reprogramado')),
  nota text,
  fed_id uuid references public.feds(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists cronogramas_seguimiento_cronograma on public.cronogramas_seguimiento (cronograma_id, created_at desc);

-- Sólo las usa el servidor (clave de servicio): sin políticas, nadie más las ve.
alter table public.cronogramas enable row level security;
alter table public.cronogramas_seguimiento enable row level security;
