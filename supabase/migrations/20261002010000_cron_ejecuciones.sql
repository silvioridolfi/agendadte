-- Registro de cada ejecución de las tareas nocturnas (Vercel Cron): cuándo corrió, a cuántos FED llegó y si se cortó por tiempo.
-- Los logs de Vercel duran poco; esto permite revisar después qué pasó. `fin` sin completar = la función se cortó antes de terminar.
create table if not exists public.cron_ejecuciones (
  id uuid primary key default gen_random_uuid(),
  tarea text not null,
  inicio timestamptz not null default now(),
  fin timestamptz,
  feds_total integer not null default 0,
  feds_procesados integer not null default 0,
  cortado_por_tiempo boolean not null default false,
  resultado jsonb
);
create index if not exists cron_ejecuciones_tarea_inicio on public.cron_ejecuciones (tarea, inicio desc);
-- Sólo la usa el servidor (clave de servicio): sin políticas, nadie más la ve.
alter table public.cron_ejecuciones enable row level security;
