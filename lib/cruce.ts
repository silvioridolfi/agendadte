// Cruce entre reclamos de conectividad y cronogramas de la misma escuela (puro).
// Es una pista, no una prueba: el cronograma no dice a qué reclamo atiende, así que nada se cierra solo.
import { esAbierto } from '@/lib/reclamos-registro'

export type EstadoCrono = 'realizado' | 'no_realizado' | 'reprogramado' | null
export type CronoCorto = { id: string, tipo: string | null, fecha_inicio: string, fecha_fin: string, proveedor: string | null, estado: EstadoCrono }
// Un reclamo abierto: los cronogramas que todavía no terminaron y el último que ya pasó y empezó después de enviado el reclamo (¿se resolvió ahí?).
export type CruceReclamo = { proximos: CronoCorto[], pasado: CronoCorto | null }
export const SIN_CRUCE: CruceReclamo = { proximos: [], pasado: null }

// Un cronograma que no se hizo o se reprogramó no sirve de pista: lo que cuenta es la ventana nueva.
const vale = (c: CronoCorto) => c.estado !== 'no_realizado' && c.estado !== 'reprogramado'

export function cruceDe(r: { estado: string, enviado_at: string }, cronos: CronoCorto[], hoy: string): CruceReclamo {
  if (!esAbierto(r.estado)) return SIN_CRUCE
  const enviado = r.enviado_at.slice(0, 10)
  const utiles = cronos.filter(vale)
  const proximos = utiles.filter(c => c.fecha_fin >= hoy).sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio))
  const pasados = utiles.filter(c => c.fecha_fin < hoy && c.fecha_inicio >= enviado).sort((a, b) => b.fecha_fin.localeCompare(a.fecha_fin))
  return { proximos, pasado: pasados[0] ?? null }
}

// Reclamos abiertos de una escuela para mostrar en sus cronogramas.
export type ReclamoCorto = { id: string, tipo_label: string, estado: string, nro_incidencia: string | null, enviado_at: string }
