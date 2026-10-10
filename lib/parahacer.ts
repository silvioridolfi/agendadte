import type { AgendaItem } from '@/lib/agenda'

// Tarjeta "Para hacer" de la agenda del FED: lo que quedó pendiente de lo que registra desde que se usa la agenda. Lo anterior (migrado de la planilla)
// ya está cargado en el formulario de Nivel Central y auditado, así que no se revisa.
export const INICIO_AGENDA = '2026-09-28'
export const DIAS_CRONOGRAMAS = 7

const PEDAGOGICAS = ['CLUB DE TECNOLOGÍA', 'PRÁCTICAS PROFESIONALIZANTES', 'TALLER/CAPACITACIÓN']
// Lo que pide el formulario de Nivel Central de cada encuentro dictado.
export type Faltante = 'participantes' | 'inscriptos' | 'tipo de jornada' | 'destinatarios'

type EncuentroMinimo = { tipo: string, asistentes: number | null, inscriptos: number | null, tipo_jornada: string | null, destinatarios: string | null }
export function faltantesDe(e: EncuentroMinimo): Faltante[] {
  if (!PEDAGOGICAS.includes(e.tipo)) return []
  const f: Faltante[] = []
  if (!e.asistentes) f.push('participantes')
  if (e.inscriptos == null) f.push('inscriptos')
  if (!(e.tipo_jornada ?? '').trim()) f.push('tipo de jornada')
  if (!(e.destinatarios ?? '').trim()) f.push('destinatarios')
  return f
}

export type CronogramaProximo = { id: string, cue: number, nombre: string | null, tipo: string | null, fecha_inicio: string, fecha_fin: string }
export type DatosParaHacer = {
  sinCerrar: AgendaItem[]
  incompletos: { item: AgendaItem, faltan: Faltante[] }[]
  jornadasPendientes: number
  cronogramas: CronogramaProximo[]
}

// Las acciones propias desde el inicio de la agenda: las planificadas con fecha pasada (hay que cerrarlas) y los encuentros pedagógicos realizados con datos
// que faltan para el formulario. Del más antiguo al más nuevo: lo más viejo es lo primero que conviene resolver.
export function calcularParaHacer({ items, fedId, hoy, jornadasPendientes, cronogramas }: { items: AgendaItem[], fedId: string, hoy: string, jornadasPendientes: number, cronogramas: CronogramaProximo[] }): DatosParaHacer {
  const propias = items.filter(i => i.fed_id === fedId && i.fecha >= INICIO_AGENDA).sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hora_inicio ?? '').localeCompare(b.hora_inicio ?? ''))
  return {
    sinCerrar: propias.filter(i => i.estado === 'planificada' && i.fecha < hoy),
    incompletos: propias.filter(i => i.estado === 'realizada').flatMap(item => {
      const faltan = [...new Set(item.encuentros.filter(e => e.fecha >= INICIO_AGENDA).flatMap(faltantesDe))]
      return faltan.length ? [{ item, faltan }] : []
    }),
    jornadasPendientes, cronogramas,
  }
}

export const hayParaHacer = (d: DatosParaHacer) => d.sinCerrar.length + d.incompletos.length + d.jornadasPendientes + d.cronogramas.length > 0
