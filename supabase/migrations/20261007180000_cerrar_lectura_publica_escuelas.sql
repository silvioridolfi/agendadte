-- El buscador anterior (v0-escuelas-crud) se retiró y la agenda lee estas tablas sólo desde el servidor (clave de servicio):
-- se cierra la lectura con la clave pública. Aplicada a mano desde el editor SQL de Supabase el 2026-10-07.
-- Para volver atrás: crear de nuevo en cada tabla `create policy "<nombre>" on public.<tabla> for select to public using (true);` y `grant select on public.<tabla> to anon, authenticated;`.
drop policy if exists "enable_public_read_access_to_contactos" on public.contactos;
drop policy if exists "enable_public_read_access_to_establecimientos" on public.establecimientos;
drop policy if exists "enable_public_read_access_to_equipamiento" on public.equipamiento_escolar;
drop policy if exists "enable_public_read_access_to_programas" on public.programas_x_cue;
drop policy if exists "enable_public_read_access_to_organismos" on public.organismos_descentralizados;
drop policy if exists "enable_public_read_access_to_historial_cambios" on public.historial_cambios;
revoke all on public.contactos, public.establecimientos, public.equipamiento_escolar, public.programas_x_cue, public.organismos_descentralizados, public.historial_cambios from anon, authenticated;
