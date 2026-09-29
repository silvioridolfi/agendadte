-- Encuentros de talleres/capacitaciones importados de CAPACITACIONES sin acción en la agenda:
-- se crea una acción realizada por encuentro (sin horario) y se vincula el mismo encuentro (no se duplica).
with nuevos as (
  insert into public.agenda_items (fed_id, school_id, lugar, fecha, accion, estado, club_id, origen, origen_ref)
  select e.fed_id, e.school_id, case when e.school_id is null then e.lugar end, e.fecha, e.tipo, 'realizada', e.club_id, 'planilla', 'enc:' || e.id
  from public.agenda_encuentros e
  where e.agenda_item_id is null and e.origen = 'planilla' and e.tipo = 'TALLER/CAPACITACIÓN'
  on conflict do nothing
  returning id, origen_ref
)
update public.agenda_encuentros e set agenda_item_id = n.id from nuevos n where n.origen_ref = 'enc:' || e.id;
