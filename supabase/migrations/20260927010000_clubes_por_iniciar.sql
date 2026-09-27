-- Clubes y prácticas "por iniciar": se planifican sin fecha y la fecha de inicio se completa
-- al programar el primer encuentro. No modifica los registros existentes.
alter table public.clubes alter column fecha_inicio drop not null;
