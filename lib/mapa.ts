// Mapa de Región 1 sin librerías: proyección Web Mercator, mosaicos de OpenStreetMap, encuadre, agrupamiento de pines y filtros.
export const TAM_TESELA = 256
export const ZOOM_MIN = 8
export const ZOOM_MAX = 18
export const URL_TESELA = (z: number, x: number, y: number) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`

// Cuadro dentro del que tiene que caer una ubicación cargada a mano (la región, con margen): evita latitudes con el signo cambiado o puntos en otro lado.
export const REGION = { latMin: -36.2, latMax: -34.4, lonMin: -58.8, lonMax: -56.8 }
export const ubicacionEnRegion = (lat: number, lon: number) => lat >= REGION.latMin && lat <= REGION.latMax && lon >= REGION.lonMin && lon <= REGION.lonMax

export type PuntoMapa = {
  id: string, tipo: 'escuela' | 'jefatura', nombre: string, lat: number, lon: number,
  cue: number | null, distrito: string | null, direccion: string | null, fed: string | null, nivel: string | null, predio: number | null,
  // Próximo cronograma de conectividad en una línea (sólo escuelas).
  crono: string | null,
}
export type Vista = { lat: number, lon: number, z: number }

// Posición en píxeles del mundo entero a ese zoom (la esquina superior izquierda del mapa es 0,0).
export const mundoPx = (lat: number, lon: number, z: number) => {
  const escala = TAM_TESELA * 2 ** z, s = Math.sin((Math.max(-85, Math.min(85, lat)) * Math.PI) / 180)
  return { x: ((lon + 180) / 360) * escala, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * escala }
}
export const deMundoPx = (x: number, y: number, z: number) => {
  const escala = TAM_TESELA * 2 ** z, n = Math.PI - (2 * Math.PI * y) / escala
  return { lat: (180 / Math.PI) * Math.atan(Math.sinh(n)), lon: (x / escala) * 360 - 180 }
}

// Encuadre que deja todos los puntos a la vista dentro de un mapa de ancho x alto píxeles. Un solo punto: zoom 16.
export function encuadrar(puntos: { lat: number, lon: number }[], ancho: number, alto: number, margen = 40): Vista {
  if (!puntos.length) return { lat: -35.2, lon: -57.8, z: 9 }
  const lats = puntos.map(p => p.lat), lons = puntos.map(p => p.lon)
  const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLon = Math.min(...lons), maxLon = Math.max(...lons)
  const centro = { lat: (minLat + maxLat) / 2, lon: (minLon + maxLon) / 2 }
  if (minLat === maxLat && minLon === maxLon) return { ...centro, z: 16 }
  let z = ZOOM_MAX
  for (; z > ZOOM_MIN; z--) {
    const a = mundoPx(maxLat, minLon, z), b = mundoPx(minLat, maxLon, z)
    if (b.x - a.x <= ancho - margen * 2 && b.y - a.y <= alto - margen * 2) break
  }
  return { ...centro, z }
}

// Mosaicos que cubren el mapa: para cada uno, la posición en pantalla (con el centro del mapa en el medio) y su tamaño.
export type Tesela = { z: number, x: number, y: number, left: number, top: number, tam: number }
export function teselasVisibles(v: Vista, ancho: number, alto: number): Tesela[] {
  const zt = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.floor(v.z))), tam = TAM_TESELA * 2 ** (v.z - zt)
  const c = mundoPx(v.lat, v.lon, zt), factor = tam / TAM_TESELA
  const n = 2 ** zt, out: Tesela[] = []
  const x0 = Math.floor((c.x - ancho / 2 / factor) / TAM_TESELA), x1 = Math.floor((c.x + ancho / 2 / factor) / TAM_TESELA)
  const y0 = Math.floor((c.y - alto / 2 / factor) / TAM_TESELA), y1 = Math.floor((c.y + alto / 2 / factor) / TAM_TESELA)
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
    if (y < 0 || y >= n) continue
    out.push({ z: zt, x: ((x % n) + n) % n, y, left: ancho / 2 + (x * TAM_TESELA - c.x) * factor, top: alto / 2 + (y * TAM_TESELA - c.y) * factor, tam })
  }
  return out
}

// Posición en pantalla de un punto, respecto del centro de la vista.
export function aPantalla(p: { lat: number, lon: number }, v: Vista, ancho: number, alto: number) {
  const c = mundoPx(v.lat, v.lon, v.z), q = mundoPx(p.lat, p.lon, v.z)
  return { x: ancho / 2 + q.x - c.x, y: alto / 2 + q.y - c.y }
}

// Agrupa los puntos que quedarían a menos de `radio` píxeles a ese zoom (en una grilla): un grupo con un solo punto es el punto mismo.
export type Grupo<T extends { lat: number, lon: number }> = { lat: number, lon: number, puntos: T[] }
export function agrupar<T extends { lat: number, lon: number }>(puntos: T[], z: number, radio = 44): Grupo<T>[] {
  const celdas = new Map<string, T[]>()
  for (const p of puntos) {
    const m = mundoPx(p.lat, p.lon, z), k = `${Math.floor(m.x / radio)}:${Math.floor(m.y / radio)}`
    const l = celdas.get(k)
    if (l) l.push(p); else celdas.set(k, [p])
  }
  return [...celdas.values()].map(l => ({ lat: l.reduce((s, p) => s + p.lat, 0) / l.length, lon: l.reduce((s, p) => s + p.lon, 0) / l.length, puntos: l }))
}

// Zoom nuevo en el punto de pantalla (px, py): ese punto del mapa queda donde estaba.
export function conZoom(v: Vista, z: number, px: number, py: number, ancho: number, alto: number): Vista {
  const nz = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z))
  const c = mundoPx(v.lat, v.lon, v.z), bajo = { x: c.x + px - ancho / 2, y: c.y + py - alto / 2 }
  const k = 2 ** (nz - v.z), nuevoBajo = { x: bajo.x * k, y: bajo.y * k }
  const centro = deMundoPx(nuevoBajo.x - (px - ancho / 2), nuevoBajo.y - (py - alto / 2), nz)
  return { ...centro, z: nz }
}
export function desplazar(v: Vista, dx: number, dy: number): Vista {
  const c = mundoPx(v.lat, v.lon, v.z)
  return { ...deMundoPx(c.x - dx, c.y - dy, v.z), z: v.z }
}

// Filtros del mapa.
export type FiltrosMapa = { distrito: string, fed: string, escuelas: boolean, jefaturas: boolean, q: string }
export const FILTROS_MAPA_VACIOS: FiltrosMapa = { distrito: '', fed: '', escuelas: true, jefaturas: true, q: '' }
export const sinTildes = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
// `fed`: '' = todos, SIN_FED_MAPA = escuelas sin FED, o el nombre del FED (con la misma coincidencia por prefijo del resto de la agenda: se pasa `esDelFed`).
export const SIN_FED_MAPA = '__sin__'
export function filtrarPuntos(puntos: PuntoMapa[], f: FiltrosMapa, coincideFed: (fedACargo: string | null, nombre: string) => boolean): PuntoMapa[] {
  const palabras = sinTildes(f.q).split(/\s+/).filter(Boolean)
  return puntos.filter(p => {
    if (p.tipo === 'escuela' ? !f.escuelas : !f.jefaturas) return false
    if (f.distrito && p.distrito !== f.distrito) return false
    // Las jefaturas no tienen FED: con un filtro por FED quedan afuera.
    if (f.fed === SIN_FED_MAPA) { if (p.tipo !== 'escuela' || p.fed) return false } else if (f.fed && (p.tipo !== 'escuela' || !coincideFed(p.fed, f.fed))) return false
    if (!palabras.length) return true
    const texto = sinTildes(`${p.nombre} ${p.cue ?? ''} ${p.direccion ?? ''}`)
    return palabras.every(w => texto.includes(w))
  })
}

// Lo que trae la pantalla del mapa: los puntos con ubicación y las escuelas que todavía no la tienen.
export type SinUbicacion = { id: string, cue: number | null, nombre: string, distrito: string | null, fed: string | null, predio: number | null }
export type PuntosMapa = { puntos: PuntoMapa[], sinUbicacion: SinUbicacion[] }
