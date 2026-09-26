-- Escuela de origen de los estudiantes, cuando difiere de la sede principal del trayecto.
-- Las prácticas PEAT de 7° Informática se desarrollan en la ES 31 y en territorio, pero los estudiantes son de la EEST N° 3 de Los Hornos (CUE 60890800).
alter table public.clubes add column if not exists escuela_origen_id uuid references public.establecimientos(id) on delete set null;
comment on column public.clubes.escuela_origen_id is 'Escuela de origen de los estudiantes, si es distinta de la sede principal (ej.: prácticas PEAT).';
update public.clubes set escuela_origen_id = (select id from public.establecimientos where cue = 60890800 limit 1)
where tipo = 'PRÁCTICAS PROFESIONALIZANTES' and grupo ilike '7° Informática%';
