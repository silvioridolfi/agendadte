import 'server-only'
import { type Usuario } from '@/lib/sesion'
import { hoyAR } from '@/lib/hora'
import { esDelFed, estadoDe } from '@/lib/cronogramas'
import { sumarDias } from '@/lib/calendario'
import { calcularParaHacer, DIAS_CRONOGRAMAS, INICIO_AGENDA, type CronogramaProximo, type DatosParaHacer } from '@/lib/parahacer'
import { getFedItemsImpl } from '@/lib/servidor/agenda'
import { contarJornadasPendientes } from '@/lib/servidor/jornadas'
import { getCronogramasImpl } from '@/lib/servidor/reclamos-cronogramas'

// Tarjeta "Para hacer": solo con los datos de quien la pide (sus acciones, sus jornadas y los cronogramas de sus escuelas).
export async function paraHacerImpl(yo: Usuario): Promise<DatosParaHacer> {
  const hoy = hoyAR(), hasta = sumarDias(hoy, DIAS_CRONOGRAMAS)
  const [items, jornadasPendientes, crono] = await Promise.all([
    getFedItemsImpl(yo.fed.id, INICIO_AGENDA, hoy),
    contarJornadasPendientes(yo, INICIO_AGENDA),
    getCronogramasImpl(yo).then(r => r.lista),
  ])
  // Los que empiezan en los próximos días o están en curso, de mis escuelas y todavía sin marcar cómo salieron.
  const cronogramas: CronogramaProximo[] = crono
    .filter(c => esDelFed(c.school?.fed_a_cargo, yo.fed.nombre_completo) && c.fecha_fin >= hoy && c.fecha_inicio <= hasta && estadoDe(c) === null)
    .map(c => ({ id: c.id, cue: c.cue, nombre: c.school?.nombre ?? null, tipo: c.tipo, fecha_inicio: c.fecha_inicio, fecha_fin: c.fecha_fin }))
  return calcularParaHacer({ items, fedId: yo.fed.id, hoy, jornadasPendientes, cronogramas })
}
