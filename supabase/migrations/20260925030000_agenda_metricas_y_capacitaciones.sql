-- Tipos de acción que usa el master de la Región 1 y faltaban
alter type public.agenda_accion add value if not exists 'ENTREGA DE TABLETS';
alter type public.agenda_accion add value if not exists 'LICENCIA';
alter type public.agenda_accion add value if not exists 'PLANIFICACIÓN';

-- Cantidad (ej. equipos desbloqueados) y datos de encuentros de clubes / talleres / prácticas
alter table public.agenda_items
  add column if not exists cantidad integer check (cantidad is null or cantidad >= 0),
  add column if not exists encuentro_n integer check (encuentro_n is null or encuentro_n > 0),
  add column if not exists propuesta text,
  add column if not exists destinatarios text,
  add column if not exists modalidad text check (modalidad is null or modalidad in ('Presencial', 'Virtual')),
  add column if not exists inscriptos integer check (inscriptos is null or inscriptos >= 0),
  add column if not exists asistentes integer check (asistentes is null or asistentes >= 0),
  -- 'app' = cargado en la agenda; 'planilla' = importado del master (permite reimportar sin duplicar)
  add column if not exists origen text not null default 'app' check (origen in ('app', 'planilla')),
  add column if not exists origen_ref text;
create unique index if not exists agenda_items_origen_ref_idx on public.agenda_items (origen_ref) where origen_ref is not null;
