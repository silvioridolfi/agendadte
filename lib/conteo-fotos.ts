import type { ConteoFotos } from '@/app/actions'
import type { AgendaItem } from '@/lib/agenda'

// Fotos de una acción: las asignadas por hora a la acción. Si no tiene, cuentan las del día del responsable y de quienes participaron
// que no quedaron asignadas a ninguna acción (fotos fuera de horario); las que ya pertenecen a otra acción no se cuentan.
export function fotosDe(item: Pick<AgendaItem, 'id' | 'fed_id' | 'fecha' | 'participantes'>, c: ConteoFotos | null): { n: number, deAccion: boolean } | null {
  if (!c) return null
  const n = c.items[item.id] ?? 0
  if (n) return { n, deAccion: true }
  const sueltas = [item.fed_id, ...(item.participantes ?? []).map(p => p.fed_id)].reduce((a, f) => a + (c.sueltas[`${f}|${item.fecha}`] ?? 0), 0)
  return { n: sueltas, deAccion: false }
}
