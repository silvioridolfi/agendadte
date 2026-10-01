-- Día del Maestro (11/9): no laborable para todo el equipo.
insert into public.feriados (fecha, nombre, tipo, distrito, confirmado)
select v.fecha, 'Día del Maestro', 'no_laborable', null, true
from (values ('2026-09-11'::date), ('2027-09-11'::date)) as v(fecha)
where not exists (select 1 from public.feriados f where f.fecha = v.fecha and f.nombre = 'Día del Maestro');
