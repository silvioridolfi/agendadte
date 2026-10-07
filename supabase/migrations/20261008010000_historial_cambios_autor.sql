-- Quién hizo cada cambio de los datos de una escuela (la edición de escuelas se hace desde la agenda).
alter table public.historial_cambios add column if not exists autor_id uuid references public.feds(id) on delete set null;
create index if not exists historial_cambios_escuela_idx on public.historial_cambios (establecimiento_id, created_at desc);
