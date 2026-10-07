import { describe, expect, it } from 'vitest'
import { FILTROS_MAPA_VACIOS, SIN_FED_MAPA, REGION, agrupar, aPantalla, conZoom, deMundoPx, desplazar, encuadrar, filtrarPuntos, mundoPx, teselasVisibles, ubicacionEnRegion, type PuntoMapa } from '@/lib/mapa'
import { esDelFed } from '@/lib/cronogramas'

const p = (id: string, nombre: string, lat: number, lon: number, extra: Partial<PuntoMapa> = {}): PuntoMapa => ({ id, tipo: 'escuela', nombre, lat, lon, cue: 60000000, distrito: 'LA PLATA', direccion: null, fed: null, nivel: null, predio: null, crono: null, ...extra })

describe('proyección', () => {
  it('ida y vuelta entre latitud/longitud y píxeles', () => {
    const m = mundoPx(-34.92, -57.95, 14), r = deMundoPx(m.x, m.y, 14)
    expect(r.lat).toBeCloseTo(-34.92, 6)
    expect(r.lon).toBeCloseTo(-57.95, 6)
  })
  it('el centro de la vista queda en el medio de la pantalla', () => {
    const v = { lat: -34.92, lon: -57.95, z: 13 }
    expect(aPantalla(v, v, 800, 600)).toEqual({ x: 400, y: 300 })
  })
})

describe('encuadre y zoom', () => {
  it('un solo punto: zoom 16 y centrado en él', () => {
    expect(encuadrar([{ lat: -34.9, lon: -57.9 }], 800, 600)).toEqual({ lat: -34.9, lon: -57.9, z: 16 })
  })
  it('varios puntos: entran todos en el mapa', () => {
    const pts = [{ lat: -35.7, lon: -58.29 }, { lat: -34.81, lon: -57.15 }]
    const v = encuadrar(pts, 800, 600)
    for (const q of pts) { const s = aPantalla(q, v, 800, 600); expect(s.x).toBeGreaterThanOrEqual(0); expect(s.x).toBeLessThanOrEqual(800); expect(s.y).toBeGreaterThanOrEqual(0); expect(s.y).toBeLessThanOrEqual(600) }
    expect(v.z).toBeGreaterThanOrEqual(8)
  })
  it('el zoom deja quieto el punto que está bajo el dedo', () => {
    const v = { lat: -34.92, lon: -57.95, z: 12 }
    const antes = deMundoPx(mundoPx(v.lat, v.lon, v.z).x + 500 - 400, mundoPx(v.lat, v.lon, v.z).y + 350 - 300, v.z)
    const n = conZoom(v, 14, 500, 350, 800, 600)
    const despues = aPantalla(antes, n, 800, 600)
    expect(despues.x).toBeCloseTo(500, 3)
    expect(despues.y).toBeCloseTo(350, 3)
  })
  it('arrastrar mueve el centro al lado contrario', () => {
    const v = { lat: -34.92, lon: -57.95, z: 12 }, n = desplazar(v, 100, 0)
    expect(n.lon).toBeLessThan(v.lon)
    expect(n.lat).toBeCloseTo(v.lat, 6)
  })
})

describe('mosaicos', () => {
  it('cubren todo el mapa', () => {
    const v = { lat: -34.92, lon: -57.95, z: 13.4 }, t = teselasVisibles(v, 800, 600)
    expect(t.length).toBeGreaterThan(0)
    expect(Math.min(...t.map(x => x.left))).toBeLessThanOrEqual(0)
    expect(Math.max(...t.map(x => x.left + x.tam))).toBeGreaterThanOrEqual(800)
    expect(Math.min(...t.map(x => x.top))).toBeLessThanOrEqual(0)
    expect(Math.max(...t.map(x => x.top + x.tam))).toBeGreaterThanOrEqual(600)
    expect(new Set(t.map(x => x.z)).size).toBe(1)
  })
})

describe('agrupar', () => {
  it('junta los cercanos y separa al acercarse', () => {
    const pts = [p('a', 'A', -34.9, -57.9), p('b', 'B', -34.9001, -57.9001), p('c', 'C', -35.5, -58.2)]
    expect(agrupar(pts, 9).map(g => g.puntos.length).sort()).toEqual([1, 2])
    expect(agrupar(pts, 18)).toHaveLength(3)
  })
})

describe('filtrarPuntos', () => {
  const pts = [
    p('1', 'EP N° 4 Mariano Moreno', -34.9, -57.9, { fed: 'Macarena Duarte Buschiazzo' }),
    p('2', 'EES N° 31', -34.8, -57.8, { distrito: 'BERISSO', fed: 'Jorge Pérez' }),
    p('3', 'JI N° 9', -34.7, -57.7, { fed: null }),
    p('4', 'JEFATURA DISTRITAL | LA PLATA', -34.91, -57.95, { tipo: 'jefatura', cue: null }),
  ]
  const f = (c: Partial<typeof FILTROS_MAPA_VACIOS>) => filtrarPuntos(pts, { ...FILTROS_MAPA_VACIOS, ...c }, esDelFed).map(x => x.id)
  it('sin filtros trae todo', () => { expect(f({})).toEqual(['1', '2', '3', '4']) })
  it('por tipo y distrito', () => {
    expect(f({ jefaturas: false })).toEqual(['1', '2', '3'])
    expect(f({ escuelas: false })).toEqual(['4'])
    expect(f({ distrito: 'BERISSO' })).toEqual(['2'])
  })
  it('por FED: las jefaturas y las de otros quedan afuera', () => {
    expect(f({ fed: 'Macarena Duarte' })).toEqual(['1'])
    expect(f({ fed: SIN_FED_MAPA })).toEqual(['3'])
  })
  it('el buscador ignora tildes y exige todas las palabras', () => {
    expect(f({ q: 'moreno ep' })).toEqual(['1'])
    expect(f({ q: 'jefatura plata' })).toEqual(['4'])
    expect(f({ q: 'zzz' })).toEqual([])
  })
})

describe('ubicacionEnRegion', () => {
  it('acepta la región y rechaza el resto', () => {
    expect(ubicacionEnRegion(-34.92, -57.95)).toBe(true)
    expect(ubicacionEnRegion(34.92, -57.95)).toBe(false)
    expect(ubicacionEnRegion(-34.92, 57.95)).toBe(false)
    expect(ubicacionEnRegion(REGION.latMin, REGION.lonMax)).toBe(true)
  })
})
