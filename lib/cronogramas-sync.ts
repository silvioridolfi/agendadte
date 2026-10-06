import 'server-only'
import { createHash } from 'node:crypto'
import { supabaseServer } from '@/lib/supabase-server'
import { exportarHojaCsv } from '@/lib/drive'
import { DIAS_ATRAS, GID_CRONOGRAMAS, ID_CONSOLIDADO, haceDias, leerCronogramas, type FilaCronograma } from '@/lib/cronogramas'
import { hoyAR } from '@/lib/hora'

export type ResultadoSync = { leidas: number, filas: number, nuevas: number, cambiadas: number, quitadas: number, sinEscuela: number, descartadas: number, duplicadas: number }

const CHUNK = 200
const trozos = <T,>(l: T[], n = CHUNK) => Array.from({ length: Math.ceil(l.length / n) }, (_, i) => l.slice(i * n, (i + 1) * n))
// Huella de lo que muestra la agenda de cada fila: si no cambia, no se toca la fecha de actualización.
const huella = (f: FilaCronograma) => createHash('sha1').update(JSON.stringify([f.fecha_inicio, f.fecha_fin, f.tipo, f.proveedor, f.nro, f.semana, f.estado_planilla, f.instaladores, f.descripcion, f.observaciones, f.predio, f.distrito, f.nombre_planilla, f.tipo_establecimiento])).digest('hex')

// Lee la pestaña Cronogramas del consolidado y deja la tabla `cronogramas` igual a la planilla (sólo los que terminan en los últimos DIAS_ATRAS días).
// La planilla nunca se modifica. Lo que desaparece de la planilla queda con en_planilla = false (no se borra: puede tener seguimiento).
export async function sincronizarCronogramas(): Promise<ResultadoSync> {
  const db = supabaseServer()
  const inicioCorrida = new Date().toISOString()
  const lectura = leerCronogramas(await exportarHojaCsv(ID_CONSOLIDADO, GID_CRONOGRAMAS))
  const desde = haceDias(hoyAR(), DIAS_ATRAS)
  const filas = lectura.filas.filter(f => f.fecha_fin >= desde)
  if (!filas.length) throw new Error('La planilla no tiene cronogramas vigentes: no se actualizó nada')

  const escuelas = new Map<number, string>()
  for (const t of trozos([...new Set(filas.map(f => f.cue))])) {
    const { data, error } = await db.from('establecimientos').select('id, cue').in('cue', t)
    if (error) throw new Error(error.message)
    for (const e of data ?? []) escuelas.set(e.cue as number, e.id as string)
  }

  const previas = new Map<string, string>()
  for (const t of trozos(filas.map(f => f.clave))) {
    const { data, error } = await db.from('cronogramas').select('clave, hash').in('clave', t)
    if (error) throw new Error(error.message)
    for (const p of data ?? []) previas.set(p.clave as string, p.hash as string)
  }

  const ahora = new Date().toISOString()
  let nuevas = 0, cambiadas = 0
  const registros = filas.map(f => {
    const h = huella(f), antes = previas.get(f.clave)
    if (antes === undefined) nuevas++
    else if (antes !== h) cambiadas++
    return { sinCambios: antes === h, fila: { ...f, school_id: escuelas.get(f.cue) ?? null, hash: h, en_planilla: true, visto_at: ahora } }
  })
  // Dos grupos por separado: las filas sin cambios no llevan actualizado_at (conservan el anterior); en un mismo upsert faltante se pondría en null.
  for (const [sin, marca] of [[true, {}], [false, { actualizado_at: ahora }]] as const) {
    for (const t of trozos(registros.filter(r => r.sinCambios === sin).map(r => ({ ...r.fila, ...marca })))) {
      const { error } = await db.from('cronogramas').upsert(t, { onConflict: 'clave' })
      if (error) throw new Error(error.message)
    }
  }

  const quitadas = await db.from('cronogramas').update({ en_planilla: false }).eq('en_planilla', true).gte('fecha_fin', desde).lt('visto_at', inicioCorrida).select('id')
  if (quitadas.error) throw new Error(quitadas.error.message)

  return { leidas: lectura.filas.length + lectura.duplicadas, filas: filas.length, nuevas, cambiadas, quitadas: quitadas.data?.length ?? 0, sinEscuela: filas.filter(f => !escuelas.has(f.cue)).length, descartadas: lectura.descartadas, duplicadas: lectura.duplicadas }
}
