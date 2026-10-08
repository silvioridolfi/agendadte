-- Comunicados del CED a los FED: se muestran como banner hasta que cada FED los marca como leídos, y el CED ve quién los leyó y cuándo.
-- Se lee y escribe solo desde el servidor (service role): RLS activada y sin políticas, igual que el resto de las tablas.
create table if not exists public.comunicados (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (char_length(titulo) between 1 and 80),
  texto text not null check (char_length(texto) between 1 and 1500),
  nivel text not null default 'informativo' check (nivel in ('importante', 'informativo')),
  -- null = todos los FED; si no, la lista de FED destinatarios.
  fed_ids uuid[],
  autor_id uuid references public.feds(id) on delete set null,
  vence_el date,
  retirado boolean not null default false,
  created_at timestamptz not null default now(),
  editado_at timestamptz
);
create index if not exists comunicados_vigentes_idx on public.comunicados (retirado, created_at desc);
alter table public.comunicados enable row level security;

create table if not exists public.comunicado_lecturas (
  comunicado_id uuid not null references public.comunicados(id) on delete cascade,
  fed_id uuid not null references public.feds(id) on delete cascade,
  leido_at timestamptz not null default now(),
  primary key (comunicado_id, fed_id)
);
alter table public.comunicado_lecturas enable row level security;

revoke all on public.comunicados, public.comunicado_lecturas from anon, authenticated;
