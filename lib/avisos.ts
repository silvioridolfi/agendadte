// Notificaciones: nivel (color) de cada tipo, cuáles se muestran como banner arriba y cuándo se avisa a los compañeros.
export type Nivel = 'urgente' | 'aviso' | 'ok' | 'info'
export type NotifBase = { id: string, tipo: string, detalle: string | null, leida: boolean, created_at: string, autor_id: string | null }

// PVE: devuelta para corregir, entrega (la ve la coordinación) o aviso/recordatorio de entrega (sin autor).
export const clasePve = (n: Pick<NotifBase, 'detalle' | 'autor_id'>): 'devuelta' | 'entrega' | 'aviso' =>
  /^Devolvió/.test(n.detalle ?? '') ? 'devuelta' : n.autor_id ? 'entrega' : 'aviso'

// Reclamo de conectividad: nuevo (lo ve el CED), resuelto o con número de ticket o incidencia (lo ve el FED que lo armó).
export const claseReclamo = (n: Pick<NotifBase, 'detalle'>): 'nuevo' | 'resuelto' | 'numero' =>
  /^Nuevo reclamo/.test(n.detalle ?? '') ? 'nuevo' : /^Se resolvió/.test(n.detalle ?? '') ? 'resuelto' : 'numero'

export function nivelDe(n: Pick<NotifBase, 'tipo' | 'detalle' | 'autor_id'>): Nivel {
  if (n.tipo === 'cancelacion') return 'urgente'
  if (n.tipo === 'respuesta') return /no puede/i.test(n.detalle ?? '') ? 'urgente' : 'ok'
  if (n.tipo === 'pve') { const c = clasePve(n); return c === 'devuelta' ? 'urgente' : c === 'entrega' ? 'ok' : 'aviso' }
  if (n.tipo === 'inactividad') return 'aviso'
  // Reclamo nuevo: amarillo (aviso); resuelto: verde; con número de ticket o incidencia: informativo.
  if (n.tipo === 'reclamo') { const c = claseReclamo(n); return c === 'nuevo' ? 'aviso' : c === 'resuelto' ? 'ok' : 'info' }
  return 'info'
}

// Banner: lo que pide una acción (aviso y recordatorio de PVE, PVE devuelta, FED sin actividad) y los avisos de reclamos de conectividad
// (reclamo nuevo para el CED; número o resolución para el FED), mientras no se lean.
export const esBanner = (n: NotifBase): boolean => !n.leida && ((n.tipo === 'pve' && clasePve(n) !== 'entrega') || n.tipo === 'inactividad' || n.tipo === 'reclamo')

const PRIORIDAD: Record<Nivel, number> = { urgente: 0, aviso: 1, ok: 2, info: 3 }
// Varios avisos de reclamos juntos: verde si todos son resoluciones; si no, de aviso.
const nivelGrupo = (g: NotifBase[]): Nivel => (g.every(n => nivelDe(n) === 'ok') ? 'ok' : 'aviso')
// El banner a mostrar (el más urgente; a igual nivel, el más nuevo) y cuántos más quedan. Los avisos de reclamos sin leer se juntan en un
// solo banner: `reclamos` trae todos (para marcarlos juntos) cuando el banner a mostrar es el de reclamos.
export function bannerDe<T extends NotifBase>(lista: T[]): { principal: T, otros: number, nivel: Nivel, reclamos: T[] } | null {
  const nuevos = (a: T, b: T) => b.created_at.localeCompare(a.created_at)
  const habilitados = lista.filter(esBanner)
  const reclamos = habilitados.filter(n => n.tipo === 'reclamo').sort(nuevos)
  const nivelDeBanner = (n: T): Nivel => (n.tipo === 'reclamo' ? nivelGrupo(reclamos) : nivelDe(n))
  const c = [...habilitados.filter(n => n.tipo !== 'reclamo'), ...(reclamos.length ? [reclamos[0]] : [])]
    .sort((a, b) => PRIORIDAD[nivelDeBanner(a)] - PRIORIDAD[nivelDeBanner(b)] || nuevos(a, b))
  if (!c.length) return null
  const principal = c[0]
  return { principal, otros: c.length - 1, nivel: nivelDeBanner(principal), reclamos: principal.tipo === 'reclamo' ? reclamos : [] }
}

// Las acciones de fechas pasadas (carga retroactiva a fin de mes) no avisan a los compañeros etiquetados.
export const avisaPorFecha = (fecha: string, hoy: string): boolean => fecha >= hoy
