-- Enlace de la reunión virtual (Meet, Zoom…): opcional, sólo lo usan las reuniones con modalidad virtual o híbrida.
alter table public.agenda_items add column if not exists enlace text;
