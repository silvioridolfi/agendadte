-- Feriados nacionales, días no laborables con fines turísticos y aniversarios de los distritos de la Región 1.
-- distrito null = aplica a todos; si no, sólo a quienes trabajan ese distrito (igual que establecimientos.distrito).
-- Fuentes: argentina.gob.ar/feriados (2026) y comunicaciones municipales. confirmado = false: fecha a verificar.
create table public.feriados (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  nombre text not null,
  tipo text not null check (tipo in ('nacional', 'turistico', 'distrital')),
  distrito text,
  confirmado boolean not null default true,
  unique nulls not distinct (fecha, distrito)
);
create index feriados_fecha_idx on public.feriados (fecha);
alter table public.feriados enable row level security;

insert into public.feriados (fecha, nombre, tipo, distrito, confirmado) values
  ('2026-01-01', 'Año Nuevo', 'nacional', null, true),
  ('2026-02-16', 'Carnaval', 'nacional', null, true),
  ('2026-02-17', 'Carnaval', 'nacional', null, true),
  ('2026-03-23', 'Feriado con fines turísticos', 'turistico', null, true),
  ('2026-03-24', 'Día Nacional de la Memoria por la Verdad y la Justicia', 'nacional', null, true),
  ('2026-04-02', 'Día del Veterano y de los Caídos en Malvinas', 'nacional', null, true),
  ('2026-04-03', 'Viernes Santo', 'nacional', null, true),
  ('2026-05-01', 'Día del Trabajador', 'nacional', null, true),
  ('2026-05-25', 'Día de la Revolución de Mayo', 'nacional', null, true),
  ('2026-06-15', 'Paso a la Inmortalidad del Gral. Güemes (trasladado del 17/6)', 'nacional', null, true),
  ('2026-06-20', 'Paso a la Inmortalidad del Gral. Belgrano', 'nacional', null, true),
  ('2026-07-09', 'Día de la Independencia', 'nacional', null, true),
  ('2026-07-10', 'Feriado con fines turísticos', 'turistico', null, true),
  ('2026-08-17', 'Paso a la Inmortalidad del Gral. San Martín', 'nacional', null, true),
  ('2026-10-12', 'Día del Respeto a la Diversidad Cultural', 'nacional', null, true),
  ('2026-11-20', 'Día de la Soberanía Nacional', 'nacional', null, true),
  ('2026-12-07', 'Feriado con fines turísticos', 'turistico', null, true),
  ('2026-12-08', 'Inmaculada Concepción de María', 'nacional', null, true),
  ('2026-12-25', 'Navidad', 'nacional', null, true),
  ('2026-05-05', 'Aniversario de Ensenada', 'distrital', 'ENSENADA', true),
  ('2026-06-24', 'Aniversario de Berisso', 'distrital', 'BERISSO', true),
  ('2026-10-21', 'Aniversario de Brandsen', 'distrital', 'BRANDSEN', true),
  ('2026-11-19', 'Aniversario de La Plata', 'distrital', 'LA PLATA', true),
  ('2026-11-20', 'Aniversario de Magdalena', 'distrital', 'MAGDALENA', false),
  ('2026-12-06', 'Aniversario de Punta Indio', 'distrital', 'PUNTA INDIO', false);
