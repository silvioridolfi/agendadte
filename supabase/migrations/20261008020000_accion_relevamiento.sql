-- Nueva acción técnica "Relevamiento" (pedido del equipo, 08/10/2026). Es aditiva: no modifica ni borra datos.
alter type public.agenda_accion add value if not exists 'RELEVAMIENTO';
