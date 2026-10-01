-- Curso completo cuando se divide en grupos (ej.: "7° Informática" en Grupo 1 y Grupo 2): las prácticas se cuentan por curso.
alter table public.clubes add column if not exists cohorte text;

-- Prácticas ya cargadas con nombre "<curso> - Grupo N": el curso es lo anterior al guion.
update public.clubes
set cohorte = btrim(split_part(grupo, ' - ', 1))
where tipo = 'PRÁCTICAS PROFESIONALIZANTES' and cohorte is null and grupo ~ ' - .*[Gg]rupo';
