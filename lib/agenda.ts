export const ACCIONES = [
  'VISITA TÉCNICA', 'VISITA PEDAGÓGICA', 'REUNIÓN', 'CLUB DE TECNOLOGÍA', 'PRÁCTICAS PROFESIONALIZANTES', 'TALLER/CAPACITACIÓN',
  'ASISTENCIA REMOTA', 'CONECTIVIDAD', 'ADMINISTRATIVO', 'CHECKLIST', 'OFICINA R1', 'PARO',
] as const
export const ESTADOS = ['planificada', 'realizada', 'reprogramada', 'cancelada'] as const

export type Accion = (typeof ACCIONES)[number]
export type Estado = (typeof ESTADOS)[number]

export type Fed = { id: string; nombre_completo: string; distritos_a_cargo: string[] }
// Fila de public.establecimientos (misma fuente que el buscador DTE).
export type School = { id: string; cue: number | null; nombre: string | null; distrito: string | null; ciudad: string | null }
export type AgendaItem = {
  id: string
  fed_id: string
  school_id: string | null
  fecha: string
  hora_inicio: string | null
  hora_fin: string | null
  accion: Accion
  sub_accion: string | null
  detalle: string | null
  estado: Estado
  created_at: string
  updated_at: string
  school: School | null
}
export type AgendaItemInput = {
  fed_id: string
  school_id: string | null
  fecha: string
  hora_inicio: string | null
  hora_fin: string | null
  accion: Accion
  sub_accion: string | null
  detalle: string | null
  estado: Estado
}
