// Reglas de los encuentros de clubes y prácticas: mínimo informativo, número de encuentro, cuándo una acción pasa a realizada y choques de horario.
import { CLUB_MIN_ENCUENTROS, esTrayecto, type Estado } from '@/lib/agenda'

// Sólo los clubes de tecnología tienen un mínimo de encuentros (8): después no importa si son más. Las prácticas se cumplen por horas, sin mínimo.
export const minEncuentros = (tipo: string | null | undefined): number | null => (tipo === 'CLUB DE TECNOLOGÍA' ? CLUB_MIN_ENCUENTROS : null)

// Texto informativo del mínimo ("mínimo 8 · faltan 3" / "mínimo 8 · cumplido"); vacío donde no hay mínimo.
export function textoMinimo(tipo: string | null | undefined, realizados: number): string {
  const min = minEncuentros(tipo)
  if (min === null) return ''
  return realizados >= min ? `mínimo ${min} · cumplido` : `mínimo ${min} · faltan ${min - realizados}`
}

type EncuentroNum = { encuentro_n: number | null, fecha: string, agenda_item_id?: string | null, item?: { estado: string } | null }

// Un encuentro sin acción asociada (planilla) ya se hizo; con acción, cuenta según su estado. Los cancelados no cuentan.
const estadoEnc = (e: EncuentroNum) => e.item?.estado ?? 'realizada'
export const esPendiente = (e: EncuentroNum) => ['planificada', 'reprogramada'].includes(estadoEnc(e))

// Número del encuentro de un club en `fecha`: sigue al último encuentro ya realizado (el mayor número cargado o la cantidad de fechas
// distintas: dos filas del mismo día son un solo encuentro) y suma las fechas planificadas anteriores (`previas`, además de las del
// propio club). Los planificados nunca alimentan la cuenta de los realizados, así no se "contagian" números entre grupos ni fechas.
export function proximoEncuentro(encuentros: EncuentroNum[], fecha?: string, excluirItem?: string, previas: string[] = []): number {
  const otros = encuentros.filter(e => !excluirItem || e.agenda_item_id !== excluirItem)
  const hechos = otros.filter(e => !esPendiente(e) && estadoEnc(e) !== 'cancelada' && (!fecha || e.fecha <= fecha))
  const base = Math.max(hechos.reduce((m, e) => Math.max(m, e.encuentro_n ?? 0), 0), new Set(hechos.map(e => e.fecha)).size)
  const hechas = new Set(hechos.map(e => e.fecha))
  const planificadas = new Set([...otros.filter(esPendiente).map(e => e.fecha), ...previas].filter(f => !!fecha && f < fecha && !hechas.has(f)))
  return base + planificadas.size + 1
}

// Una acción de club o práctica de hoy o anterior, todavía planificada, pasa a realizada cuando se cargan datos del encuentro
// (inscriptos, participantes reales, descripción o cierre). Las canceladas y las futuras no se tocan.
export function estadoAlCompletar(p: { accion: string | null, estado: Estado, fecha: string, hoy: string, inscriptos: string, asistentes: string, descripcion: string, esCierre: boolean }): Estado {
  if (!esTrayecto(p.accion as never) || (p.estado !== 'planificada' && p.estado !== 'reprogramada') || p.fecha > p.hoy) return p.estado
  const conDatos = p.inscriptos.trim() !== '' || p.asistentes.trim() !== '' || p.descripcion.trim() !== '' || p.esCierre
  return conDatos ? 'realizada' : p.estado
}

// ¿Se pisan dos horarios (HH:MM)? Uno a continuación del otro (12:00–13:00 y 13:00–14:00) no se pisan; sin horario de inicio no se puede decir.
export function horariosSePisan(a: { ini: string, fin: string }, b: { ini: string, fin: string }): boolean {
  return !!a.ini && !!b.ini && (a.ini < (b.fin || b.ini) || a.ini === b.ini) && (b.ini < (a.fin || a.ini) || a.ini === b.ini)
}
