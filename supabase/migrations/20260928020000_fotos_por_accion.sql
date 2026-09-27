-- Fotos por actividad: dentro de la carpeta del día, una subcarpeta por acción, según la hora de captura.
create table if not exists public.fotos_acciones (
  fed_id uuid not null references public.feds(id) on delete cascade,
  item_id uuid not null references public.agenda_items(id) on delete cascade,
  folder_id text not null,
  nombre text,
  updated_at timestamptz not null default now(),
  primary key (fed_id, item_id)
);
alter table public.fotos_acciones enable row level security;
alter table public.fotos_procesadas add column if not exists item_id uuid;
