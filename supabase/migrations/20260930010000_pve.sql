-- Planillas de Visita a Escuelas (PVE): cada FED sube su PDF mensual a una carpeta "PVE MM-AAAA" dentro de su carpeta de Drive
-- (la que ya comparte con la cuenta técnica). La agenda detecta el archivo, lo renombra y la coordinación las descarga juntas.
alter table public.feds add column if not exists carpeta_pve_id text;

create table if not exists public.pve (
  fed_id uuid not null references public.feds(id) on delete cascade,
  mes date not null check (extract(day from mes) = 1),
  folder_id text not null,
  file_id text,
  nombre text,
  entregada_at timestamptz,
  enviada_at timestamptz,
  enviada_por uuid references public.feds(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (fed_id, mes)
);
alter table public.pve enable row level security;

alter table public.notificaciones drop constraint if exists notificaciones_tipo_check;
alter table public.notificaciones add constraint notificaciones_tipo_check check (tipo = any (array['etiqueta', 'modificacion', 'cancelacion', 'respuesta', 'evento', 'pve']));
