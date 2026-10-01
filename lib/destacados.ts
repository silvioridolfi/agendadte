// Lo que acaba de pasar y conviene destacar un momento en las tarjetas: la acción recién guardada (destello) y las
// recién marcadas como realizadas (sello). Lo carga la página y dura unos segundos.
export type Destacados = { guardado: string | null, realizadas: ReadonlySet<string> }

type ConId = { id: string, visita?: { id: string }[] | null }

export function claseDestacado(d: Destacados, item: ConId): { clase: string, realizada: boolean } {
  const ids = item.visita?.map(v => v.id) ?? [item.id]
  const realizada = ids.some(id => d.realizadas.has(id))
  return { clase: realizada ? 'anim-realizada' : d.guardado && ids.includes(d.guardado) ? 'anim-destello' : '', realizada }
}
