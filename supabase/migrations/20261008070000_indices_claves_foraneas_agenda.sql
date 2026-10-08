-- Auditoría, lote 3 (R3). Claves foráneas de la agenda sin índice (aviso del analizador de rendimiento): al borrar una acción, un club o un FED,
-- la base busca en estas tablas lo que depende de ellos. Ya aplicada en la base. No se indexan las columnas de autoría de la auditoría
-- (autor_id, enviada_por, creado_por, actualizado_por): solo se consultan al borrar un FED, algo que casi no ocurre.
create index if not exists agenda_encuentros_school_id_idx on public.agenda_encuentros (school_id);
create index if not exists agenda_items_club_id_idx on public.agenda_items (club_id);
create index if not exists clubes_school_id_idx on public.clubes (school_id);
create index if not exists clubes_escuela_origen_id_idx on public.clubes (escuela_origen_id);
create index if not exists comunicado_lecturas_fed_id_idx on public.comunicado_lecturas (fed_id);
create index if not exists cronogramas_seguimiento_fed_id_idx on public.cronogramas_seguimiento (fed_id);
create index if not exists fotos_acciones_item_id_idx on public.fotos_acciones (item_id);
create index if not exists notificaciones_item_id_idx on public.notificaciones (item_id);
create index if not exists notificaciones_autor_id_idx on public.notificaciones (autor_id);
create index if not exists notificaciones_evento_id_idx on public.notificaciones (evento_id);

-- R4: índice duplicado (idéntico a idx_historial_cambios_establecimiento).
drop index if exists public.historial_cambios_escuela_idx;
