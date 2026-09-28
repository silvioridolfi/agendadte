-- Tipos de feriado: se suman "provincial" y "no_laborable" (no laborables para todo el equipo, como los nacionales).
alter table public.feriados drop constraint feriados_tipo_check;
alter table public.feriados add constraint feriados_tipo_check check (tipo = any (array['nacional','provincial','no_laborable','turistico','distrital','receso']));
