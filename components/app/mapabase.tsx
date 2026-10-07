'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { ZOOM_MAX, ZOOM_MIN, URL_TESELA, agrupar, aPantalla, conZoom, desplazar, encuadrar, teselasVisibles, type PuntoMapa, type Vista } from '@/lib/mapa'

// Mapa propio sobre las imágenes de OpenStreetMap, sin librerías: se arrastra con el dedo o el mouse, se acerca con pellizco, rueda, doble toque o los botones,
// y los pines cercanos se agrupan con un número. El padre lo vuelve a montar (con `key`) cuando cambia lo que tiene que mostrar, y entonces se reencuadra.
type Props = {
  puntos: PuntoMapa[], propios?: Set<string>, seleccionId?: string | null, onSelect?: (p: PuntoMapa) => void,
  inicial?: Vista, className?: string, rueda?: boolean, agrupa?: boolean, etiqueta: string,
}

export function MapaBase({ puntos, propios, seleccionId, onSelect, inicial, className = 'h-[60dvh] min-h-72', rueda = true, agrupa = true, etiqueta }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [tam, setTam] = useState<{ w: number, h: number } | null>(null)
  const [vista, setVista] = useState<Vista | null>(inicial ?? null)
  const punteros = useRef(new Map<number, { x: number, y: number }>())
  const gesto = useRef<{ x0: number, y0: number, movido: boolean, dist0: number, z0: number }>({ x0: 0, y0: 0, movido: false, dist0: 0, z0: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setTam({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const base = useMemo(() => (tam ? (inicial ?? encuadrar(puntos, tam.w, tam.h)) : null), [tam, inicial, puntos])
  const v = vista ?? base
  const zInt = v ? Math.round(v.z) : 0
  const grupos = useMemo(() => (agrupa ? agrupar(puntos, zInt) : puntos.map(p => ({ lat: p.lat, lon: p.lon, puntos: [p] }))), [puntos, zInt, agrupa])
  const w = tam?.w ?? 0, h = tam?.h ?? 0

  // La rueda tiene que poder cancelar el desplazamiento de la página, y eso pide un listener no pasivo.
  useEffect(() => {
    const el = ref.current
    if (!el || !rueda || !base || !tam) return
    const alRodar = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      setVista(act => { const x = act ?? base; return conZoom(x, x.z - e.deltaY * 0.0025, e.clientX - r.left, e.clientY - r.top, tam.w, tam.h) })
    }
    el.addEventListener('wheel', alRodar, { passive: false })
    return () => el.removeEventListener('wheel', alRodar)
  }, [rueda, base, tam])

  const alBajar = (e: React.PointerEvent) => {
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesto.current
    if (punteros.current.size === 1) { g.x0 = e.clientX; g.y0 = e.clientY; g.movido = false }
    else if (punteros.current.size === 2) {
      const [a, b] = [...punteros.current.values()]
      g.dist0 = Math.hypot(a.x - b.x, a.y - b.y) || 1; g.z0 = v?.z ?? 0; g.movido = true
    }
  }
  const alMover = (e: React.PointerEvent) => {
    const previo = punteros.current.get(e.pointerId)
    if (!previo || !base || !tam) return
    const g = gesto.current, el = ref.current!
    punteros.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (punteros.current.size >= 2) {
      const [a, b] = [...punteros.current.values()], r = el.getBoundingClientRect()
      const z = g.z0 + Math.log2((Math.hypot(a.x - b.x, a.y - b.y) || 1) / g.dist0)
      setVista(act => conZoom(act ?? base, z, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, tam.w, tam.h))
      return
    }
    if (!g.movido && Math.hypot(e.clientX - g.x0, e.clientY - g.y0) < 6) return
    if (!g.movido) { g.movido = true; el.setPointerCapture(e.pointerId) }
    const dx = e.clientX - previo.x, dy = e.clientY - previo.y
    setVista(act => desplazar(act ?? base, dx, dy))
  }
  const alSoltar = (e: React.PointerEvent) => { punteros.current.delete(e.pointerId) }
  const zoomEn = (dz: number, px = w / 2, py = h / 2) => { if (base && tam) setVista(act => { const x = act ?? base; return conZoom(x, Math.round(x.z) + dz, px, py, tam.w, tam.h) }) }
  const alDobleToque = (e: React.MouseEvent) => { const r = ref.current!.getBoundingClientRect(); zoomEn(1, e.clientX - r.left, e.clientY - r.top) }
  const alAgrupado = (g: { lat: number, lon: number, puntos: PuntoMapa[] }) => {
    if (!tam) return
    const e = encuadrar(g.puntos, tam.w, tam.h, 60)
    setVista({ lat: g.lat, lon: g.lon, z: Math.min(ZOOM_MAX, Math.max(e.z, Math.floor(v!.z) + 1)) })
  }

  return <div ref={ref} role="application" aria-label={etiqueta} style={{ touchAction: 'none' }} onPointerDown={alBajar} onPointerMove={alMover} onPointerUp={alSoltar} onPointerCancel={alSoltar} onDoubleClick={alDobleToque}
    className={`relative w-full select-none overflow-hidden rounded-card border border-dte-linea bg-[#e9e6df] ${className}`}>
    {v && tam && teselasVisibles(v, tam.w, tam.h).map(t => (
      <img key={`${t.z}/${t.x}/${t.y}`} src={URL_TESELA(t.z, t.x, t.y)} alt="" draggable={false} className="pointer-events-none absolute max-w-none" onError={e => { e.currentTarget.style.visibility = 'hidden' }} style={{ left: t.left, top: t.top, width: t.tam + 0.5, height: t.tam + 0.5 }} />
    ))}
    {v && tam && [...grupos].sort((a, b) => Number(a.puntos.some(p => p.id === seleccionId)) - Number(b.puntos.some(p => p.id === seleccionId))).map(g => {
      const s = aPantalla(g, v, tam.w, tam.h)
      if (s.x < -40 || s.y < -40 || s.x > tam.w + 40 || s.y > tam.h + 40) return null
      const estilo = { left: s.x, top: s.y }
      if (g.puntos.length > 1) return <button key={`g-${g.puntos[0].id}-${g.puntos.length}`} type="button" onClick={() => alAgrupado(g)} aria-label={`${g.puntos.length} lugares agrupados: acercar`} style={estilo}
        className="absolute flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-dte-violeta text-xs font-bold text-white shadow-md">{g.puntos.length}</button>
      const p = g.puntos[0], elegido = p.id === seleccionId, propio = propios?.has(p.id)
      return <button key={p.id} type="button" onClick={() => onSelect?.(p)} aria-label={p.nombre} aria-pressed={elegido} style={estilo} disabled={!onSelect}
        className="absolute flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center disabled:cursor-default">
        <span className={`block border-2 border-white shadow-md transition-transform ${p.tipo === 'jefatura' ? 'size-3.5 rotate-45 rounded-sm bg-dte-violeta' : `size-3.5 rounded-full ${propio ? 'bg-dte-magenta' : 'bg-dte-petroleo'}`} ${elegido ? 'scale-150 ring-2 ring-dte-magenta ring-offset-1' : ''}`} />
      </button>
    })}
    <div className="absolute right-2 top-2 flex flex-col overflow-hidden rounded-control border border-dte-linea bg-white shadow-sm">
      <button type="button" onClick={() => zoomEn(1)} disabled={!v || v.z >= ZOOM_MAX} aria-label="Acercar" className="flex size-10 items-center justify-center text-dte-tinta hover:bg-dte-fondo disabled:opacity-40"><Plus className="size-4" aria-hidden /></button>
      <span className="h-px bg-dte-linea" />
      <button type="button" onClick={() => zoomEn(-1)} disabled={!v || v.z <= ZOOM_MIN} aria-label="Alejar" className="flex size-10 items-center justify-center text-dte-tinta hover:bg-dte-fondo disabled:opacity-40"><Minus className="size-4" aria-hidden /></button>
    </div>
    <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="absolute bottom-0 right-0 rounded-tl bg-white/85 px-1.5 py-0.5 text-[10px] text-dte-gris">© OpenStreetMap</a>
  </div>
}

// Mapa chico de una sola escuela (la ficha): arrastrable y con zoom con los botones, sin rueda para no trabar el scroll de la ficha.
export function MapaChico({ lat, lon, nombre }: { lat: number, lon: number, nombre: string }) {
  const puntos = useMemo<PuntoMapa[]>(() => [{ id: 'unico', tipo: 'escuela', nombre, lat, lon, cue: null, distrito: null, direccion: null, fed: null, nivel: null }], [lat, lon, nombre])
  const inicial = useMemo(() => ({ lat, lon, z: 16 }), [lat, lon])
  return <MapaBase key={`${lat},${lon}`} puntos={puntos} inicial={inicial} agrupa={false} rueda={false} className="h-48" etiqueta={`Ubicación de ${nombre} en el mapa`} />
}
