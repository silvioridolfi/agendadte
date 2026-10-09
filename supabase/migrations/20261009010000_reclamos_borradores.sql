-- Borradores de reclamos de conectividad: el FED guarda el reclamo armado (por ejemplo cuando lo deja programado en Gmail para otro momento)
-- y lo marca como enviado cuando sale. Hasta entonces no figura en el registro ni se avisa al CED.
-- Se lee y escribe solo desde el servidor (service role): RLS activada y sin políticas, igual que el resto de las tablas.
create table if not exists public.reclamos_borradores (
  id uuid primary key default gen_random_uuid(),
  fed_id uuid not null references public.feds(id) on delete cascade,
  school_id uuid references public.establecimientos(id) on delete set null,
  cue integer,
  escuela_nombre text,
  tipo text not null,
  tipo_label text not null,
  asunto text not null check (char_length(asunto) between 1 and 300),
  para text check (para is null or char_length(para) <= 200),
  cuerpo text not null check (char_length(cuerpo) between 1 and 8000),
  adjuntos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists reclamos_borradores_fed_asunto_idx on public.reclamos_borradores (fed_id, asunto);
create index if not exists reclamos_borradores_school_idx on public.reclamos_borradores (school_id);
alter table public.reclamos_borradores enable row level security;
revoke all on public.reclamos_borradores from anon, authenticated;
