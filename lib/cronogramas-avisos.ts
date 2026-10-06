import 'server-only'
import { supabaseServer } from '@/lib/supabase-server'
import { noLaborables } from '@/lib/pve'
import { avisoNuevosCed, avisoNuevosFed, avisoRecordatorioCed, avisoRecordatorioFed, cuandoEmpieza, esHabil, proximoHabil, repartirPorFed } from '@/lib/cronogramas'
import { hoyAR } from '@/lib/hora'

export type ResultadoAvisos = { nuevos: number, recordados: number, feds: number, ced: number }

type Fila = { id: string, cue: number, fecha_inicio: string, fecha_fin: string, tipo: string | null, school: { nombre: string | null, fed_a_cargo: string | null } | null }
const COLS = 'id, cue, fecha_inicio, fecha_fin, tipo, school:establecimientos(nombre, fed_a_cargo)'
const trozos = <T,>(l: T[], n = 200) => Array.from({ length: Math.ceil(l.length / n) }, (_, i) => l.slice(i * n, (i + 1) * n))

// Avisos de cronogramas, una vez por cronograma (las marcas avisado_at y recordado_at evitan repetirlos si la tarea corre dos veces):
// - nuevos en la planilla: un aviso agrupado por FED y un resumen para el CED (con cuántos quedaron sin FED asignado);
// - recordatorio: el día hábil anterior al comienzo, igual (un aviso por FED y un resumen para el CED).
export async function avisarCronogramas(hoy = hoyAR()): Promise<ResultadoAvisos> {
  const db = supabaseServer()
  const { data: personas, error } = await db.from('feds').select('id, nombre_completo, rol')
  if (error) throw new Error(error.message)
  const feds = (personas ?? []).filter(p => p.rol === 'fed') as { id: string, nombre_completo: string }[]
  const ceds = (personas ?? []).filter(p => p.rol === 'coordinacion') as { id: string }[]
  const res: ResultadoAvisos = { nuevos: 0, recordados: 0, feds: 0, ced: 0 }

  const enviar = async (filas: Fila[], texto: { fed: (cs: Fila[]) => string, ced: (total: number, sin: number) => string }) => {
    if (!filas.length) return
    const { porFed, sinFed } = repartirPorFed(filas, feds)
    const avisos = [...porFed].map(([fed_id, cs]) => ({ fed_id, tipo: 'cronograma', detalle: texto.fed(cs) }))
      .concat(ceds.map(c => ({ fed_id: c.id, tipo: 'cronograma', detalle: texto.ced(filas.length, sinFed.length) })))
    const { error: e } = await db.from('notificaciones').insert(avisos)
    if (e) throw new Error(e.message)
    res.feds += porFed.size; res.ced += ceds.length
  }
  const marcar = async (ids: string[], columna: 'avisado_at' | 'recordado_at') => {
    for (const t of trozos(ids)) {
      const { error: e } = await db.from('cronogramas').update({ [columna]: new Date().toISOString() }).in('id', t)
      if (e) throw new Error(e.message)
    }
  }

  // Nuevos: los que terminaron antes de hoy no se avisan (sólo se marcan).
  const { data: pendientes, error: e1 } = await db.from('cronogramas').select(COLS).eq('en_planilla', true).is('avisado_at', null)
  if (e1) throw new Error(e1.message)
  const nuevos = (pendientes ?? []) as unknown as Fila[]
  await enviar(nuevos.filter(c => c.fecha_fin >= hoy), { fed: avisoNuevosFed, ced: avisoNuevosCed })
  await marcar(nuevos.map(c => c.id), 'avisado_at')
  res.nuevos = nuevos.filter(c => c.fecha_fin >= hoy).length

  // Recordatorio: sólo en días hábiles; cubre lo que empieza hasta el próximo día hábil (un fin de semana o feriado en el medio entra el día anterior).
  const noLab = await noLaborables(hoy, proximoHabil(hoy))
  if (esHabil(hoy, noLab)) {
    const habil = proximoHabil(hoy, noLab), cuando = cuandoEmpieza(hoy, habil)
    const { data, error: e2 } = await db.from('cronogramas').select(COLS).eq('en_planilla', true).is('recordado_at', null).gt('fecha_inicio', hoy).lte('fecha_inicio', habil)
    if (e2) throw new Error(e2.message)
    const filas = (data ?? []) as unknown as Fila[]
    await enviar(filas, { fed: cs => avisoRecordatorioFed(cs, cuando), ced: (t, s) => avisoRecordatorioCed(t, s, cuando) })
    await marcar(filas.map(c => c.id), 'recordado_at')
    res.recordados = filas.length
  }
  return res
}
