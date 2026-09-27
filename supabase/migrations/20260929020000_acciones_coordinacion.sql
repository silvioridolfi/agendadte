-- Acciones propias de la coordinación (CED). Son institucionales y no suman a las métricas de los FED.
alter type agenda_accion add value if not exists 'REUNIÓN CON JEFATURA';
alter type agenda_accion add value if not exists 'ACOMPAÑAMIENTO A FED';
alter type agenda_accion add value if not exists 'GESTIÓN INSTITUCIONAL';
alter type agenda_accion add value if not exists 'SEGUIMIENTO DEL EQUIPO';
