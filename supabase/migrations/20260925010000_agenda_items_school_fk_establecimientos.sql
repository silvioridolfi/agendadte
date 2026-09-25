-- Las escuelas salen de public.establecimientos (misma fuente que el buscador DTE), no de bitacora_pp.schools.
alter table public.agenda_items drop constraint agenda_items_school_id_fkey;
alter table public.agenda_items add constraint agenda_items_school_id_fkey foreign key (school_id) references public.establecimientos(id) on delete set null;
