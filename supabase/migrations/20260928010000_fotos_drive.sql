-- Fotos de las acciones en Google Drive: cada FED comparte una carpeta propia con la cuenta técnica de la agenda.
-- La agenda ordena las fotos sueltas en subcarpetas por día (según la fecha de captura). No se guardan imágenes.
alter table public.feds add column if not exists carpeta_fotos_id text;
alter table public.feds add column if not exists carpeta_fotos_url text;

-- Subcarpeta de cada día dentro de la carpeta del FED (para el acceso "Fotos de ese día").
create table if not exists public.fotos_dias (
  fed_id uuid not null references public.feds(id) on delete cascade,
  fecha date not null,
  folder_id text not null,
  nombre text,
  updated_at timestamptz not null default now(),
  primary key (fed_id, fecha)
);
-- Archivos ya ordenados (para no volver a procesarlos).
create table if not exists public.fotos_procesadas (
  fed_id uuid not null references public.feds(id) on delete cascade,
  file_id text not null,
  fecha date,
  modo text not null,
  created_at timestamptz not null default now(),
  primary key (fed_id, file_id)
);
alter table public.fotos_dias enable row level security;
alter table public.fotos_procesadas enable row level security;
