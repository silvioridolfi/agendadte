// Registro de reclamos de conectividad: estados, tipo de conexión, tipo de número y filtros del panel (puro).
import { enlacesDe, tienePiso } from '@/lib/reclamos'
import { esDelFed } from '@/lib/cronogramas'

export const ESTADOS_RECLAMO = ['enviado', 'en_proceso', 'resuelto', 'anulado'] as const
export type EstadoReclamo = typeof ESTADOS_RECLAMO[number]
export const ESTADO_RECLAMO_LABEL: Record<EstadoReclamo, string> = { enviado: 'Reclamo enviado', en_proceso: 'En proceso', resuelto: 'Resuelto', anulado: 'Anulado' }
// Plural para los contadores del panel (cada uno cuenta varios reclamos).
export const ESTADO_RECLAMO_PLURAL: Record<EstadoReclamo, string> = { enviado: 'Reclamos enviados', en_proceso: 'En proceso', resuelto: 'Resueltos', anulado: 'Anulados' }
// Clases completas (Tailwind) de cada estado.
export const ESTADO_RECLAMO_CLASE: Record<EstadoReclamo, string> = {
  enviado: 'border-reclamo-enviado bg-reclamo-enviado text-reclamo-enviado-texto', en_proceso: 'border-reclamo-proceso bg-reclamo-proceso text-white',
  resuelto: 'border-reclamo-resuelto bg-reclamo-resuelto text-white', anulado: 'border-dte-linea bg-dte-fondo text-dte-gris',
}
export const esAbierto = (e: string) => e === 'enviado' || e === 'en_proceso'

// Un FED puede marcar como resuelto un reclamo abierto de una escuela a su cargo (o que registró él): muchas veces la escuela le avisa a él y no al CED.
// Sólo "Resuelto" y sin avisos: el CED sigue siendo quien anota números y el resto de los estados.
export const puedeResolverReclamo = (quien: { id: string, nombre: string }, r: Pick<Reclamo, 'estado' | 'fed_id' | 'school'>) =>
  esAbierto(r.estado) && (r.fed_id === quien.id || esDelFed(r.school?.fed_a_cargo, quien.nombre))
// Notas del reclamo: la nueva se suma a la que ya había, en otro renglón.
export const sumarNota = (previa: string | null | undefined, nueva: string | null | undefined) => [previa, nueva].map(x => (x ?? '').trim()).filter(Boolean).join('\n') || null

export type Reclamo = {
  id: string, fed_id: string | null, school_id: string | null, cue: number | null, tipo: string, tipo_label: string, conexion: string | null, asunto: string,
  enviado_at: string, estado: EstadoReclamo, nro_incidencia: string | null, notas: string | null, resuelto_at: string | null, origen: 'app' | 'planilla',
  // Quién hizo el último cambio (el CED o el FED que lo marcó resuelto).
  actualizado_por?: string | null,
  school: { nombre: string | null, distrito: string | null, ciudad: string | null, fed_a_cargo?: string | null } | null,
}

// Tipo de conexión como lo anota el CED: "Piso PNCE y Enlace PBA", "Piso y Enlace PNCE", "Enlace PBA (Sin piso)".
export function conexionDe(e: { plan_enlace: string | null, subplan_enlace: string | null, plan_piso_tecnologico: string | null }): string {
  const enl = enlacesDe(e.plan_enlace, e.subplan_enlace)
  const enlace = enl.length ? (enl.every(x => x === 'PNCE') ? 'PNCE' : enl.every(x => x !== 'PNCE') ? 'PBA' : 'PNCE y PBA') : null
  const piso = tienePiso(e) ? (/PNCE/i.test(e.plan_piso_tecnologico ?? '') && /PBA/i.test(e.plan_piso_tecnologico ?? '') ? 'PNCE y PBA' : /PBA/i.test(e.plan_piso_tecnologico ?? '') ? 'PBA' : 'PNCE') : null
  if (piso && enlace) return piso === enlace ? `Piso y Enlace ${enlace}` : `Piso ${piso} y Enlace ${enlace}`
  if (enlace) return `Enlace ${enlace} (Sin piso)`
  if (piso) return `Piso ${piso} (Sin enlace)`
  return 'Sin datos de conectividad'
}

// Qué es el número que llega de Nivel Central: "NI-000234800" es una incidencia de Educar; "ticket 337918" o "incidente 336001", de PBA.
export function origenDeNumero(n: string | null): 'Educar' | 'PBA' | null {
  const t = (n ?? '').trim()
  if (!t) return null
  if (/\bNI-?\s*\d+/i.test(t)) return 'Educar'
  if (/ticket|incidente|\bpba\b/i.test(t) || /^\d{5,7}\.?$/.test(t)) return 'PBA'
  return null
}

export type FiltrosReclamo = { estado: 'abiertos' | 'todos' | EstadoReclamo, fedId: string, conexion: string, busqueda: string }
const sinTildes = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
export function filtrarReclamos(lista: Reclamo[], f: FiltrosReclamo, nombreFed: (id: string | null) => string): Reclamo[] {
  const q = sinTildes(f.busqueda.trim())
  return lista.filter(r =>
    (f.estado === 'todos' ? true : f.estado === 'abiertos' ? esAbierto(r.estado) : r.estado === f.estado)
    && (!f.fedId || r.fed_id === f.fedId) && (!f.conexion || r.conexion === f.conexion)
    && (!q || sinTildes(`${r.asunto} ${r.cue ?? ''} ${r.school?.nombre ?? ''} ${r.school?.distrito ?? ''} ${r.nro_incidencia ?? ''} ${r.notas ?? ''} ${nombreFed(r.fed_id)}`).includes(q)))
}

export const resumenReclamos = (lista: Reclamo[]) => ({
  enviados: lista.filter(r => r.estado === 'enviado').length, enProceso: lista.filter(r => r.estado === 'en_proceso').length, resueltos: lista.filter(r => r.estado === 'resuelto').length,
})

// Aviso al CED cuando un FED registra un reclamo nuevo.
export const avisoDeAlta = (r: { cue: number | null, tipo_label: string }): string => `Nuevo reclamo de CUE ${r.cue ?? '—'} · ${r.tipo_label}`

// Aviso al FED que envió un reclamo cuando el CED anota el número o lo marca como resuelto (null si no hay nada que avisar).
export function avisoDeCambio(antes: { estado: string, nro_incidencia: string | null }, despues: { estado: string, nro_incidencia: string | null }, r: { cue: number | null, tipo_label: string }): string | null {
  const que = `CUE ${r.cue ?? '—'} · ${r.tipo_label}`
  if (despues.estado === 'resuelto' && antes.estado !== 'resuelto') return `Se resolvió el reclamo de ${que}${despues.nro_incidencia ? ` (${despues.nro_incidencia})` : ''}`
  if (despues.nro_incidencia && despues.nro_incidencia !== antes.nro_incidencia && despues.estado !== 'anulado') return `Llegó el número del reclamo de ${que}: ${despues.nro_incidencia}`
  return null
}
