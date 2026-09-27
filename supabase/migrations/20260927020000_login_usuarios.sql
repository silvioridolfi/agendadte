-- Login de la agenda: cada perfil (FED o coordinación) se vincula a su cuenta de Supabase Auth por correo.
-- `es_admin`: administra usuarios (alta y reseteo de contraseñas). `debe_cambiar_password`: contraseña temporal
-- pendiente de cambio en el próximo ingreso.
alter table public.feds add column if not exists email text;
alter table public.feds add column if not exists es_admin boolean not null default false;
alter table public.feds add column if not exists debe_cambiar_password boolean not null default false;
create unique index if not exists feds_email_unico on public.feds (lower(email));

update public.feds set email = 'jmachado4@abc.gob.ar' where rol = 'coordinacion' and nombre_completo = 'Coordinación Región 1';
update public.feds set email = 'mduartebuschiazzo@abc.gob.ar' where nombre_completo = 'Macarena Duarte Buschiazzo';
update public.feds set email = 'silvioridolfi@abc.gob.ar', es_admin = true where nombre_completo = 'Silvio Ridolfi';
update public.feds set email = 'jperez11@abc.gob.ar' where nombre_completo = 'Jorge Pérez';
update public.feds set email = 'marcospettina@abc.gob.ar' where nombre_completo = 'Marcos Pettiná';
update public.feds set email = 'dcortes4@abc.gob.ar' where nombre_completo = 'Daniela Cortes';
update public.feds set email = 'aguzman12@abc.gob.ar' where nombre_completo = 'Andrés Guzmán';
update public.feds set email = 'carfranco3@abc.gob.ar' where nombre_completo = 'Carlos Franco';
