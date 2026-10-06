-- Cronogramas, entrega 2: marcas de aviso (para no avisar dos veces) y nuevo tipo de notificación.
alter table public.cronogramas add column if not exists avisado_at timestamptz;
alter table public.cronogramas add column if not exists recordado_at timestamptz;

-- Lo que ya estaba cargado antes de esta entrega no se avisa como "nuevo"; el recordatorio sólo corre para los que empiezan después de hoy.
update public.cronogramas set avisado_at = now() where avisado_at is null;
update public.cronogramas set recordado_at = now() where recordado_at is null and fecha_inicio <= (now() at time zone 'America/Argentina/Buenos_Aires')::date;

alter table public.notificaciones drop constraint if exists notificaciones_tipo_check;
alter table public.notificaciones add constraint notificaciones_tipo_check check (tipo = any (array['etiqueta', 'modificacion', 'cancelacion', 'respuesta', 'evento', 'pve', 'inactividad', 'reclamo', 'cronograma']));
