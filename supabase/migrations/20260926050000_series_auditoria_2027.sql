-- Mejoras (opciones 4, 5, 6, 8 del análisis).

-- Receso escolar como un tipo más de la tabla de feriados (editable sin tocar el código).
alter table public.feriados drop constraint if exists feriados_tipo_check;
alter table public.feriados add constraint feriados_tipo_check check (tipo in ('nacional', 'turistico', 'distrital', 'receso'));
insert into public.feriados (fecha, nombre, tipo, distrito, confirmado)
select d::date, 'Receso invernal', 'receso', null, true
from generate_series('2026-07-20'::date, '2026-07-31'::date, interval '1 day') d
where extract(isodow from d) < 6
  and not exists (select 1 from public.feriados f where f.fecha = d::date and f.tipo = 'receso');

-- Feriados nacionales 2027. Los trasladables siguen la Ley 27.399 (mar/mié → lunes anterior, jue/vie → lunes siguiente)
-- y quedan "a confirmar" hasta el decreto; los días no laborables con fines turísticos 2027 todavía no están publicados.
insert into public.feriados (fecha, nombre, tipo, distrito, confirmado)
select v.fecha::date, v.nombre, 'nacional', null, v.conf
from (values
  ('2027-01-01', 'Año Nuevo', true),
  ('2027-02-08', 'Carnaval', true),
  ('2027-02-09', 'Carnaval', true),
  ('2027-03-24', 'Día Nacional de la Memoria por la Verdad y la Justicia', true),
  ('2027-03-26', 'Viernes Santo', true),
  ('2027-04-02', 'Día del Veterano y de los Caídos en la Guerra de Malvinas', true),
  ('2027-05-01', 'Día del Trabajador', true),
  ('2027-05-25', 'Día de la Revolución de Mayo', true),
  ('2027-06-21', 'Paso a la Inmortalidad del Gral. Martín Miguel de Güemes (trasladado)', false),
  ('2027-06-20', 'Paso a la Inmortalidad del Gral. Manuel Belgrano', true),
  ('2027-07-09', 'Día de la Independencia', true),
  ('2027-08-16', 'Paso a la Inmortalidad del Gral. José de San Martín (trasladado)', false),
  ('2027-10-11', 'Día del Respeto a la Diversidad Cultural (trasladado)', false),
  ('2027-11-20', 'Día de la Soberanía Nacional', false),
  ('2027-12-08', 'Inmaculada Concepción de María', true),
  ('2027-12-25', 'Navidad', true)
) v(fecha, nombre, conf)
where not exists (select 1 from public.feriados f where f.fecha = v.fecha::date and f.tipo = 'nacional');

-- Aniversarios distritales 2027 (mismo día y mes que 2026).
insert into public.feriados (fecha, nombre, tipo, distrito, confirmado)
select (f.fecha + interval '1 year')::date, f.nombre, f.tipo, f.distrito, f.confirmado
from public.feriados f
where f.tipo = 'distrital' and extract(year from f.fecha) = 2026
  and not exists (select 1 from public.feriados g where g.tipo = 'distrital' and g.distrito = f.distrito and g.fecha = (f.fecha + interval '1 year')::date);

-- Series: acciones que se repiten (ej.: club todos los miércoles). club_id deja preelegido el club al completar cada encuentro.
alter table public.agenda_items
  add column if not exists serie_id uuid,
  add column if not exists club_id uuid references public.clubes(id) on delete set null;
create index if not exists agenda_items_serie_idx on public.agenda_items (serie_id);

-- Respuesta de cada compañero etiquetado y nuevos tipos de notificación.
alter table public.agenda_participantes add column if not exists respuesta text not null default 'pendiente' check (respuesta in ('pendiente', 'acepta', 'rechaza'));
alter table public.notificaciones drop constraint if exists notificaciones_tipo_check;
alter table public.notificaciones add constraint notificaciones_tipo_check check (tipo in ('etiqueta', 'modificacion', 'cancelacion', 'respuesta'));
alter table public.notificaciones add column if not exists detalle text;

-- Historial de cambios: quién hizo qué y cuándo.
create table if not exists public.auditoria (
  id bigint generated always as identity primary key,
  tabla text not null,
  registro_id uuid,
  operacion text not null check (operacion in ('alta', 'modificacion', 'baja', 'estado')),
  autor_id uuid references public.feds(id) on delete set null,
  datos jsonb,
  created_at timestamptz not null default now()
);
create index if not exists auditoria_registro_idx on public.auditoria (registro_id, created_at desc);
alter table public.auditoria enable row level security;
