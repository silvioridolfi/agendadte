-- Reporte de jornadas pedagógicas: marca de los encuentros que ya se cargaron en el formulario de Nivel Central (compartida entre quienes los ven,
-- así no se cargan dos veces). `datos` guarda lo que había que cargar al marcar, para avisar si el encuentro se modificó después.
-- Se lee y escribe solo desde el servidor (service role): RLS activada y sin políticas, igual que el resto de las tablas.
create table if not exists public.jornadas_cargadas (
  encuentro_id uuid primary key references public.agenda_encuentros(id) on delete cascade,
  cargado_por uuid references public.feds(id) on delete set null,
  cargado_at timestamptz not null default now(),
  datos text not null default '' check (char_length(datos) <= 20000)
);
create index if not exists jornadas_cargadas_por_idx on public.jornadas_cargadas (cargado_por);
alter table public.jornadas_cargadas enable row level security;
revoke all on public.jornadas_cargadas from anon, authenticated;
