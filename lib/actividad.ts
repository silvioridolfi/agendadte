// Actividad de cada FED en la agenda, para que el CED y la administración vean cuándo hace falta acompañar.
// Cuenta lo que se carga o se cambia en la agenda (altas, ediciones, estados, bajas), no los ingresos ni los cambios de perfil.
// Sólo se cuentan días hábiles: sin fines de semana, feriados, recesos, enero ni los días de licencia o paro del propio FED.
import { diasHabilesEntre } from '@/lib/agenda'
import { ZONA } from '@/lib/hora'

// Días hábiles seguidos sin actividad a partir de los cuales se avisa.
export const UMBRAL_DIAS_HABILES = 5

// Fecha (AAAA-MM-DD) en Argentina de un instante guardado en UTC.
export const fechaAR = (ts: string) => new Date(ts).toLocaleDateString('en-CA', { timeZone: ZONA })

// Días hábiles transcurridos desde la última actividad hasta hoy (0 si fue hoy). `ausencias`: días de licencia o paro del FED.
// Sin actividad registrada devuelve null: no hay desde cuándo contar.
export function diasSinActividad(ultima: string | null, hoy: string, noHabiles: Set<string>, ausencias?: Set<string>): number | null {
  if (!ultima) return null
  if (ultima >= hoy) return 0
  return diasHabilesEntre(ultima, hoy, ausencias?.size ? new Set([...noHabiles, ...ausencias]) : noHabiles)
}
export const hayAlerta = (dias: number | null) => dias !== null && dias >= UMBRAL_DIAS_HABILES

export const textoDias = (n: number) => (n === 0 ? 'hoy' : n === 1 ? 'hace 1 día hábil' : `hace ${n} días hábiles`)
const corta = (f: string) => `${f.slice(8, 10)}/${f.slice(5, 7)}`
// Detalle del aviso: neutro, sin juicios.
export const detalleAviso = (ultima: string, dias: number) => `Última actividad registrada el ${corta(ultima)} · ${textoDias(dias)}`

// Lo que se ve en "Mi equipo" (sólo CED y administración).
export type Actividad = { fed_id: string, ultima: string | null, dias: number | null, alerta: boolean }

// A quién avisar: un solo aviso por persona y por período sin actividad, a la coordinación y a la administración, nunca al propio FED.
// Si ya hay un aviso posterior a su última actividad, no se repite; cuando el FED vuelve a cargar algo, el período termina y un nuevo silencio genera otro aviso.
export type Inactivo = { fed_id: string, ultima: string, ultima_ts: string | null, dias: number }
export type AvisoPrevio = { fed_id: string, autor_id: string, created_at: string }
export function avisosPendientes(inactivos: Inactivo[], destinatarios: string[], previas: AvisoPrevio[]) {
  return inactivos.flatMap(a => destinatarios
    .filter(d => d !== a.fed_id && !previas.some(p => p.fed_id === d && p.autor_id === a.fed_id && (!a.ultima_ts || Date.parse(p.created_at) > Date.parse(a.ultima_ts))))
    .map(d => ({ fed_id: d, autor_id: a.fed_id, tipo: 'inactividad' as const, detalle: detalleAviso(a.ultima, a.dias) })))
}
