// Ficha de una escuela (buscador): datos del establecimiento, historial de acciones y clubes o prácticas.
import type { AgendaItem } from '@/lib/agenda'

export type DatosEscuela = {
  id: string, cue: number | null, nombre: string | null, alias: string | null, distrito: string | null, ciudad: string | null, direccion: string | null,
  nivel: string | null, modalidad: string | null, ambito: string | null, turnos: string | null,
  matricula: number | null, varones: number | null, mujeres: number | null, secciones: number | null, fed_a_cargo: string | null,
  // Texto para "Cómo llegar" (la dirección o el punto cargado); sin dato, null.
  mapa: string | null,
}
// Una fila del historial. Para quien no participó de la acción sólo llegan fecha, tipo, estado y responsable; `item` (el detalle) va para las propias y para la coordinación.
export type FilaHistorial = { id: string, fed_id: string, fecha: string, hora_inicio: string | null, accion: string, sub_accion: string | null, estado: string, propia: boolean, item?: AgendaItem }
export type ClubDeEscuela = { id: string, tipo: string, grupo: string | null, propuesta: string | null, fed_id: string, fecha_inicio: string | null, fecha_cierre: string | null, cohorte: string | null, realizados: number, esOrigen: boolean }
// `puedeEditar`: quien mira es admin, CED o el FED a cargo de la escuela.
// `conectividad`: los datos de enlace y piso tecnológico, por clave (ver CAMPOS_ESCUELA); la ven todos.
export type FichaEscuela = { escuela: DatosEscuela, conectividad: Record<string, string | null>, historial: FilaHistorial[], clubes: ClubDeEscuela[], puedeEditar: boolean }

// Lo que viene: planificadas de hoy en adelante, de la más próxima a la más lejana. Lo anterior: de la más nueva a la más vieja.
export function separarHistorial(filas: FilaHistorial[], hoy: string) {
  const porFecha = (a: FilaHistorial, b: FilaHistorial) => a.fecha.localeCompare(b.fecha) || (a.hora_inicio ?? '').localeCompare(b.hora_inicio ?? '')
  const proximas = filas.filter(f => f.estado === 'planificada' && f.fecha >= hoy).sort(porFecha)
  const ids = new Set(proximas.map(f => f.id))
  return { proximas, anteriores: filas.filter(f => !ids.has(f.id)).sort((a, b) => porFecha(b, a)) }
}

// Números de la cabecera: realizadas, FED distintos que la visitaron y fecha de la última realizada.
export function resumenHistorial(filas: FilaHistorial[]) {
  const hechas = filas.filter(f => f.estado === 'realizada')
  return { realizadas: hechas.length, feds: new Set(hechas.map(f => f.fed_id)).size, ultima: hechas.reduce<string | null>((m, f) => (!m || f.fecha > m ? f.fecha : m), null) }
}
