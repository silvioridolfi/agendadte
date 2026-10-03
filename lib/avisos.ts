// Notificaciones: nivel (color) de cada tipo, cuáles se muestran como banner arriba y cuándo se avisa a los compañeros.
export type Nivel = 'urgente' | 'aviso' | 'ok' | 'info'
export type NotifBase = { id: string, tipo: string, detalle: string | null, leida: boolean, created_at: string, autor_id: string | null }

// PVE: devuelta para corregir, entrega (la ve la coordinación) o aviso/recordatorio de entrega (sin autor).
export const clasePve = (n: Pick<NotifBase, 'detalle' | 'autor_id'>): 'devuelta' | 'entrega' | 'aviso' =>
  /^Devolvió/.test(n.detalle ?? '') ? 'devuelta' : n.autor_id ? 'entrega' : 'aviso'

export function nivelDe(n: Pick<NotifBase, 'tipo' | 'detalle' | 'autor_id'>): Nivel {
  if (n.tipo === 'cancelacion') return 'urgente'
  if (n.tipo === 'respuesta') return /no puede/i.test(n.detalle ?? '') ? 'urgente' : 'ok'
  if (n.tipo === 'pve') { const c = clasePve(n); return c === 'devuelta' ? 'urgente' : c === 'entrega' ? 'ok' : 'aviso' }
  if (n.tipo === 'inactividad') return 'aviso'
  // Reclamo de conectividad: resuelto (verde) o con número de ticket o incidencia (informativo).
  if (n.tipo === 'reclamo') return /^Se resolvió/.test(n.detalle ?? '') ? 'ok' : 'info'
  return 'info'
}

// Banner: lo que pide una acción (aviso y recordatorio de PVE, PVE devuelta, FED sin actividad) y todavía no se leyó.
export const esBanner = (n: NotifBase): boolean => !n.leida && ((n.tipo === 'pve' && clasePve(n) !== 'entrega') || n.tipo === 'inactividad')

const PRIORIDAD: Record<Nivel, number> = { urgente: 0, aviso: 1, ok: 2, info: 3 }
// El banner a mostrar (el más urgente; a igual nivel, el más nuevo) y cuántos más quedan.
export function bannerDe<T extends NotifBase>(lista: T[]): { principal: T, otros: number } | null {
  const c = lista.filter(esBanner).sort((a, b) => PRIORIDAD[nivelDe(a)] - PRIORIDAD[nivelDe(b)] || b.created_at.localeCompare(a.created_at))
  return c.length ? { principal: c[0], otros: c.length - 1 } : null
}

// Las acciones de fechas pasadas (carga retroactiva a fin de mes) no avisan a los compañeros etiquetados.
export const avisaPorFecha = (fecha: string, hoy: string): boolean => fecha >= hoy
