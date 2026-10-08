// Quién ve qué (puro): los datos del equipo completo son solo de la coordinación y la administración; cada FED recibe lo suyo.
// El servidor aplica estas reglas en cada lectura; la pantalla ya mostraba solo lo propio, pero no se puede confiar en el navegador.
export type Quien = { esAdmin: boolean, rol: string, id: string }

export const veTodoElEquipo = (q: Pick<Quien, 'esAdmin' | 'rol'>) => q.esAdmin || q.rol === 'coordinacion'

// Agenda de un FED: la propia, o la de cualquiera si ve todo el equipo.
export const puedeVerAgendaDe = (q: Quien, fedId: string) => veTodoElEquipo(q) || fedId === q.id

// Una acción (o su historial) la ve quien la creó, quien está etiquetado en ella y quien ve todo el equipo.
export const puedeVerAccion = (q: Quien, accion: { fed_id: string, participantes: string[] }) =>
  veTodoElEquipo(q) || accion.fed_id === q.id || accion.participantes.includes(q.id)

// Carpetas de fotos que se pueden pedir: quien ve todo, las que pida; un FED, la suya y, si pide las de una acción en la que participa, las de quienes participan en ella.
export function fedsDeFotosPermitidos(q: Quien, pedidos: string[], accion?: { fed_id: string, participantes: string[] } | null): string[] {
  if (veTodoElEquipo(q)) return pedidos
  const permitidos = new Set([q.id])
  if (accion && puedeVerAccion(q, accion)) { permitidos.add(accion.fed_id); accion.participantes.forEach(p => permitidos.add(p)) }
  return pedidos.filter(id => permitidos.has(id))
}
