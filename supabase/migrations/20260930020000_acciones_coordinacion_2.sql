-- Tareas de coordinación según la planificación del CED 2026: informes técnicos y articulación con Inspección.
alter type agenda_accion add value if not exists 'INFORME TÉCNICO';
alter type agenda_accion add value if not exists 'REUNIÓN CON INSPECCIÓN';
