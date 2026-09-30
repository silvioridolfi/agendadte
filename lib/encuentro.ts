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

// Número del próximo encuentro de un club: el siguiente al mayor número cargado o a la cantidad de fechas distintas (el mismo criterio del servidor).
export function proximoEncuentro(encuentros: { encuentro_n: number | null, fecha: string }[]): number {
  return Math.max(encuentros.reduce((m, e) => Math.max(m, e.encuentro_n ?? 0), 0), new Set(encuentros.map(e => e.fecha)).size) + 1
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
