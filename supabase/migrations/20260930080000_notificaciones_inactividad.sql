-- Nuevo tipo de notificación: aviso a la coordinación y a la administración cuando un FED lleva varios días hábiles sin actividad en la agenda.
-- Para deshacerlo: delete from public.notificaciones where tipo = 'inactividad'; y volver a crear la restricción sin ese tipo.
alter table public.notificaciones drop constraint if exists notificaciones_tipo_check;
alter table public.notificaciones add constraint notificaciones_tipo_check
  check (tipo = any (array['etiqueta', 'modificacion', 'cancelacion', 'respuesta', 'evento', 'pve', 'inactividad']));
