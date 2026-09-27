-- Devolución de PVE: la coordinación devuelve una planilla con un motivo; el FED sube la corregida y queda "reentregada".
alter table public.pve add column if not exists devuelta_at timestamptz;
alter table public.pve add column if not exists motivo_devolucion text;
alter table public.pve add column if not exists reentregada_at timestamptz;

create table if not exists public.pve_historial (
  id uuid primary key default gen_random_uuid(),
  fed_id uuid not null references public.feds(id) on delete cascade,
  mes date not null,
  tipo text not null check (tipo in ('entregada', 'devuelta', 'reentregada', 'enviada')),
  motivo text,
  autor_id uuid references public.feds(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.pve_historial enable row level security;
create index if not exists pve_historial_fed_mes_idx on public.pve_historial (fed_id, mes);
