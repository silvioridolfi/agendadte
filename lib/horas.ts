// Asignación de una foto a una acción de la agenda según la hora de captura (sin dependencias de servidor).
const TOLERANCIA = 30 // minutos antes o después del horario de la acción
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

