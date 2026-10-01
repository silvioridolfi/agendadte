// Asignación de una foto a una acción de la agenda según la hora de captura (sin dependencias de servidor).
export const TOLERANCIA = 30 // minutos antes o después del horario de la acción
const aMin = (h: string) => { const [a, b] = h.split(':').map(Number); return a * 60 + b }

// Acción a la que corresponde una foto por su hora: la única cuyo horario la contiene o, si ninguna, la única más
// cercana dentro de la tolerancia. Si hay dos posibles (acciones superpuestas) no se asigna: queda en la carpeta del día.
export function accionPorHora<T extends { hora_inicio: string | null, hora_fin: string | null }>(items: T[], minutos: number | null): T | null {
  if (minutos == null) return null
  const conHora = items.filter(i => i.hora_inicio).map(i => { const ini = aMin(i.hora_inicio!); return { i, ini, fin: i.hora_fin ? Math.max(aMin(i.hora_fin), ini) : ini + 60 } })
  const dentro = conHora.filter(x => minutos >= x.ini && minutos < x.fin)
  if (dentro.length) return dentro.length === 1 ? dentro[0].i : null
  const cerca = conHora.map(x => ({ ...x, d: minutos < x.ini ? x.ini - minutos : minutos - x.fin })).filter(x => x.d <= TOLERANCIA).sort((a, b) => a.d - b.d)
  return cerca.length && (cerca.length === 1 || cerca[0].d < cerca[1].d) ? cerca[0].i : null
}


// Ubicación: complemento de la hora (nunca la contradice). Radio en metros alrededor de la escuela.
export type Punto = { lat: number, lon: number }
const RADIO = 300
export function distanciaM(a: Punto, b: Punto) {
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(h))
}
type ConLugar = { hora_inicio: string | null, hora_fin: string | null, school?: { lat?: number | null, lon?: number | null } | null }
// La acción más cercana al lugar de la foto (dentro del radio), si es claramente la más cercana.
function porLugar<T extends ConLugar>(lista: T[], pos: Punto | null): T | null {
  if (!pos) return null
  const c = lista.flatMap(i => (i.school?.lat != null && i.school?.lon != null ? [{ i, d: distanciaM(pos, { lat: i.school.lat, lon: i.school.lon }) }] : []))
    .filter(x => x.d <= RADIO).sort((a, b) => a.d - b.d)
  return c.length && (c.length === 1 || c[0].d < c[1].d - 50) ? c[0].i : null
}
// Acción de una foto: primero la hora; si hay dos acciones posibles a esa hora, desempata la ubicación;
// si la hora no coincide con ninguna, la ubicación (a menos de 300 m de la escuela de una acción del día).
export function accionPorFoto<T extends ConLugar>(items: T[], minutos: number | null, pos: Punto | null): T | null {
  if (minutos != null) {
    const dentro = items.filter(i => i.hora_inicio).filter(i => { const ini = aMin(i.hora_inicio!), fin = i.hora_fin ? Math.max(aMin(i.hora_fin), ini) : ini + 60; return minutos >= ini && minutos < fin })
    if (dentro.length === 1) return dentro[0]
    if (dentro.length > 1) return porLugar(dentro, pos)
  }
  return accionPorHora(items, minutos) ?? porLugar(items, pos)
}
