# Migraciones: estado del registro (8/10/2026)

El historial de migraciones de la base (`supabase_migrations`) y la carpeta `supabase/migrations/` no coinciden del todo. No afecta a la agenda, pero conviene saberlo antes de reconstruir la base desde cero.

- **Números de versión distintos:** la base usa la fecha y hora en que se aplicó cada migración; los archivos, la fecha en que se escribieron. Los nombres sí coinciden (por ejemplo `cronogramas_avisos`).
- **Archivos sin registro en la base** (aplicados a mano en el SQL Editor o por otra vía): `peat_grupos_sin_sede`, `reclamos_importacion_planilla`, `cerrar_lectura_publica_escuelas`, `portal_escuelas_cerrar_acceso_abierto`, `revocar_ejecucion_funciones_definer_ajenas`.
- **Registros en la base sin archivo en la carpeta:** `clubes_por_grado_fix_regex`, `redes_ep81_en_club`, `cept18_encuentros_en_club`, `practicas_tipo_jornada_formacion` y las migraciones de las otras aplicaciones del proyecto (`bitacora_pp`, `portal_escuelas`).
- **Regla desde ahora:** cada cambio de base lleva su archivo en la carpeta, con la fecha de la sesión, en el mismo pull request.

Para reconstruir la base hay que partir de un respaldo de Supabase, no de la carpeta sola.
