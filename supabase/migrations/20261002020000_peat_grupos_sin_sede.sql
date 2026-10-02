-- Los grupos de PEAT ya no llevan una sede fija: se identifican por la escuela de origen de sus estudiantes y cada encuentro
-- guarda el lugar donde se hizo. Se corrigen los dos grupos existentes (7° Informática - Grupo 1 y 2), que tenían la EES N° 31
-- (la escuela del primer encuentro) como sede. Los encuentros no se tocan.
update public.clubes set school_id = null, lugar = null, updated_at = now()
where id in ('e8ad42ad-37f4-4552-b62c-93bfc77a31cc', '0fa66ac0-f14c-494e-b299-31fa6024b0d1')
  and tipo::text = 'PRÁCTICAS PROFESIONALIZANTES' and escuela_origen_id is not null and school_id is not null;
-- Revertir (devuelve la EES N° 31 como sede, CUE 60897700):
--   update public.clubes set school_id = (select id from public.establecimientos where cue = 60897700)
--   where id in ('e8ad42ad-37f4-4552-b62c-93bfc77a31cc', '0fa66ac0-f14c-494e-b299-31fa6024b0d1');
