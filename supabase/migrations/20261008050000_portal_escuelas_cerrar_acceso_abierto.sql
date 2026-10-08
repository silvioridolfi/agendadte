-- Auditoría, lote 1 (S0). El portal de escuelas no está en uso: se cierran las políticas abiertas ("permitir todo") para usuarios sin sesión y con sesión.
-- Las tablas quedan con seguridad por fila y sin políticas (nadie accede desde la API); cuando se retome el portal se definen políticas por rol.
-- Se conserva la lectura pública de coordinador_ced y fed_directorio. Aplicada a mano en el SQL Editor (verificada: quedan 2 políticas, sin permisos de escritura).
do $$
declare p record;
begin
  for p in select tablename, policyname from pg_policies
           where schemaname = 'portal_escuelas'
             and tablename in ('cambios_pendientes','conectividad','contactos_pendientes','equipo_directivo','fed_asignado','solicitudes')
  loop
    execute format('drop policy %I on portal_escuelas.%I', p.policyname, p.tablename);
  end loop;
end $$;

revoke all on portal_escuelas.cambios_pendientes, portal_escuelas.conectividad, portal_escuelas.contactos_pendientes,
  portal_escuelas.equipo_directivo, portal_escuelas.fed_asignado, portal_escuelas.solicitudes from anon, authenticated;
revoke insert, update, delete, truncate on portal_escuelas.coordinador_ced, portal_escuelas.fed_directorio from anon, authenticated;
