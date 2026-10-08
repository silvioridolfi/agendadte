-- "Reunión con Nivel Central" y "Articulación municipal" estaban en el código (acciones del CED) pero no en el tipo agenda_accion:
-- al elegirlas, el guardado fallaba. Migración aditiva (ya aplicada en la base).
alter type public.agenda_accion add value if not exists 'REUNIÓN CON NIVEL CENTRAL';
alter type public.agenda_accion add value if not exists 'ARTICULACIÓN MUNICIPAL';
