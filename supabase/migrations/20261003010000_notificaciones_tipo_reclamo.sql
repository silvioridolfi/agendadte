-- Nuevo tipo de notificación: el CED anota el N° de ticket o de incidencia de un reclamo de conectividad (o lo marca resuelto) y se avisa al FED que lo envió.
alter table public.notificaciones drop constraint if exists notificaciones_tipo_check;
alter table public.notificaciones add constraint notificaciones_tipo_check check (tipo = any (array['etiqueta', 'modificacion', 'cancelacion', 'respuesta', 'evento', 'pve', 'inactividad', 'reclamo']));
