-- Auditoría, lote 1 (S7). Funciones SECURITY DEFINER de la bitácora y del portal que no hace falta ejecutar desde la API. Ya aplicada en la base.
-- Disparadores: la base los ejecuta sola al activarse el disparador (no piden EXECUTE al disparar); verificado actualizando una orden de trabajo como usuario con sesión.
revoke execute on function bitacora_pp.handle_new_user() from public, anon, authenticated;
revoke execute on function bitacora_pp.link_work_orders_on_new_session() from public, anon, authenticated;
revoke execute on function bitacora_pp.protect_profile_columns() from public, anon, authenticated;
revoke execute on function bitacora_pp.set_ot_codigo() from public, anon, authenticated;
revoke execute on function bitacora_pp.sync_equipment_estado_actual() from public, anon, authenticated;
revoke execute on function bitacora_pp.sync_work_order_session() from public, anon, authenticated;
revoke execute on function portal_escuelas.aplicar_cambio_aprobado() from public, anon, authenticated;
revoke execute on function portal_escuelas.aplicar_contacto_aprobado() from public, anon, authenticated;
-- Solo lee (máximo + 1): sin sesión no hace falta. Se conserva para usuarios con sesión.
revoke execute on function bitacora_pp.generate_ot_codigo(text, integer) from public, anon;

-- Para deshacer (por ejemplo, si la bitácora llamara generate_ot_codigo sin sesión):
--   grant execute on function bitacora_pp.generate_ot_codigo(text, integer) to anon;
-- No se tocaron is_admin, attendance_session_editable ni session_matches_own_grupo: las usan 21 políticas de la bitácora.
