-- Ajustes de acciones y datos (pedido de coordinación, 26/09/2026).

-- 1) "Entrega de tablets" pasa a ser la acción general "Entrega de equipamiento".
alter type public.agenda_accion rename value 'ENTREGA DE TABLETS' to 'ENTREGA DE EQUIPAMIENTO';

-- 2) Checklist es una sub-acción de Conectividad.
update public.agenda_items set accion = 'CONECTIVIDAD',
  sub_accion = case when sub_accion is null or sub_accion = '' then 'Checklist' else 'Checklist, ' || sub_accion end
where accion = 'CHECKLIST';

-- 3) Paro: se hace en el lugar de trabajo (DTE).
update public.agenda_items set school_id = (select id from public.establecimientos where cue = 60000000 limit 1), lugar = null
where accion = 'PARO' and school_id is null;

-- 4) Propuesta "Uso Responsable de Redes Sociales" (typo "Responable" en la planilla).
update public.agenda_encuentros set propuesta = 'Uso Responsable de Redes Sociales: Ciudadanía Digital en el Aula'
where propuesta ilike '%respon%ble de redes%';
-- Encuentros de club cuyo contenido fue el taller de redes / ciudadanía digital.
update public.agenda_encuentros set propuesta = 'Uso Responsable de Redes Sociales: Ciudadanía Digital en el Aula'
where tipo = 'CLUB DE TECNOLOGÍA' and descripcion ~* '(redes sociales|uso de redes|taller de redes|ciudadan[ií]a digital)';
-- Talleres de redes dados a un grupo que tenía el club en curso: son parte del club.
with t as (
  select e.id, e.agenda_item_id, c.id club_id from public.agenda_encuentros e
  join public.clubes c on c.fed_id = e.fed_id and c.school_id = e.school_id
    and e.fecha between c.fecha_inicio and coalesce(c.fecha_cierre, e.fecha)
  where e.tipo = 'TALLER/CAPACITACIÓN' and e.propuesta ilike '%redes sociales%'
    and (select count(*) from public.clubes c2 where c2.fed_id = e.fed_id and c2.school_id = e.school_id and e.fecha between c2.fecha_inicio and coalesce(c2.fecha_cierre, e.fecha)) = 1
)
update public.agenda_encuentros e set tipo = 'CLUB DE TECNOLOGÍA', club_id = t.club_id from t where e.id = t.id;
update public.agenda_items i set accion = 'CLUB DE TECNOLOGÍA'
where i.accion = 'TALLER/CAPACITACIÓN' and exists (select 1 from public.agenda_encuentros e where e.agenda_item_id = i.id and e.tipo = 'CLUB DE TECNOLOGÍA')
  and not exists (select 1 from public.agenda_encuentros e where e.agenda_item_id = i.id and e.tipo <> 'CLUB DE TECNOLOGÍA');

-- 5) Tipo de jornada de los encuentros de club importados (la planilla no lo tenía): el club es un taller,
--    salvo las jornadas de presentación o sensibilización que la descripción identifica.
update public.agenda_encuentros set tipo_jornada = case
    when descripcion ~* 'sensibiliz' then 'Sensibilización'
    when descripcion ~* '(presentaci[oó]n del club|presentaci[oó]n y bienvenida|se present[oó] el club)' then 'Presentación'
    else 'Taller' end
where tipo = 'CLUB DE TECNOLOGÍA' and tipo_jornada is null;

-- 6) Prácticas Educativas en Ambientes de Trabajo (PEAT): mismos trayectos que los clubes (tabla clubes con tipo).
alter table public.clubes add column if not exists tipo public.agenda_accion not null default 'CLUB DE TECNOLOGÍA';
update public.agenda_encuentros set propuesta = 'Prácticas Educativas en Ambientes de Trabajo'
where tipo = 'PRÁCTICAS PROFESIONALIZANTES' and (propuesta is null or propuesta = 'Club de Tecnología');
-- Cada grupo de estudiantes es un trayecto; las prácticas se hacen en distintas escuelas, así que el trayecto
-- se asocia a la escuela de origen de los estudiantes (la ES 31 de La Plata para 7° Informática).
insert into public.clubes (fed_id, school_id, grupo, tipo, propuesta, fecha_inicio, encuentros_previstos)
select e.fed_id, (select id from public.establecimientos where nombre like 'ESCUELA DE EDUCACIÓN SECUNDARIA N° 31 GRAL%' limit 1),
  initcap(lower(regexp_replace(e.destinatarios, '^ESTUDIANTES DE\s*', ''))), 'PRÁCTICAS PROFESIONALIZANTES',
  'Prácticas Educativas en Ambientes de Trabajo', min(e.fecha), 8
from public.agenda_encuentros e
where e.tipo = 'PRÁCTICAS PROFESIONALIZANTES' and e.destinatarios ilike '%7° INFORM%'
group by e.fed_id, e.destinatarios;
update public.agenda_encuentros e set club_id = c.id, tipo_jornada = coalesce(e.tipo_jornada, 'Acompañamiento')
from public.clubes c
where e.tipo = 'PRÁCTICAS PROFESIONALIZANTES' and c.tipo = 'PRÁCTICAS PROFESIONALIZANTES' and c.fed_id = e.fed_id
  and c.grupo = initcap(lower(regexp_replace(e.destinatarios, '^ESTUDIANTES DE\s*', '')));

-- 7) Talleres de redes cargados como "Taller" con propuesta "Club de Tecnología" y dictados en el marco del club (EP 81).
update public.agenda_encuentros e set tipo = 'CLUB DE TECNOLOGÍA', propuesta = 'Uso Responsable de Redes Sociales: Ciudadanía Digital en el Aula', tipo_jornada = 'Taller',
  club_id = (select c.id from public.clubes c where c.fed_id = e.fed_id and c.school_id = e.school_id and c.tipo = 'CLUB DE TECNOLOGÍA' and e.fecha between c.fecha_inicio and coalesce(c.fecha_cierre, e.fecha) limit 1)
where e.tipo = 'TALLER/CAPACITACIÓN' and e.propuesta = 'Club de Tecnología' and e.descripcion ~* 'taller de redes';
update public.agenda_items i set accion = 'CLUB DE TECNOLOGÍA'
where i.accion = 'TALLER/CAPACITACIÓN' and exists (select 1 from public.agenda_encuentros e where e.agenda_item_id = i.id and e.tipo = 'CLUB DE TECNOLOGÍA')
  and not exists (select 1 from public.agenda_encuentros e where e.agenda_item_id = i.id and e.tipo <> 'CLUB DE TECNOLOGÍA');

-- 8) CEPT 18 (Brandsen): dos talleres del 7/7 y 25/8 con propuesta "Club de Tecnología" son encuentros del club (confirmado por coordinación).
update public.agenda_encuentros set tipo = 'CLUB DE TECNOLOGÍA', tipo_jornada = coalesce(tipo_jornada, 'Taller'), club_id = '69aeaaba-d815-43a0-a618-b180811d83c8'
where id in ('daf96660-ff3c-44cf-a908-2786df49507a', '7ea3d784-66bd-4c3c-92b2-35a9acdfba8b');
update public.agenda_items i set accion = 'CLUB DE TECNOLOGÍA'
where i.id in ('c9b73c9a-5ed3-4812-8e09-17fd6abf6514', '9bee4286-db73-4bf7-ab70-267d76bf5e90')
  and not exists (select 1 from public.agenda_encuentros e where e.agenda_item_id = i.id and e.tipo <> 'CLUB DE TECNOLOGÍA');

-- 9) Las prácticas (PEAT) son jornadas de formación, no de acompañamiento.
update public.agenda_encuentros set tipo_jornada = 'Formación' where tipo = 'PRÁCTICAS PROFESIONALIZANTES' and tipo_jornada = 'Acompañamiento';
