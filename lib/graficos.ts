// Gráficos de los informes en PDF y Excel (CED y FED). Un solo generador de SVG autocontenido (colores en hexadecimal, sin clases):
// va inline en el PDF y se rasteriza a PNG para el Excel. Todo texto dinámico se escapa.
import { CATEGORIA, CATEGORIA_LABEL, CATEGORIAS, type AgendaItem, type Categoria, cuentaHecha } from '@/lib/agenda'
import { porTipo } from '@/lib/informes'
import { titleCase } from '@/lib/format'

// Mismos colores que --color-cat-* de globals.css (validados con la guía de dataviz); un test verifica que coincidan.
export const CAT_HEX: Record<Categoria, string> = { tecnica: '#2a6fb0', pedagogica: '#d41c6c', institucional: '#6f5fc2' }
const INSCRIPTOS_HEX = '#b7d0e8' // tinte del azul de asistentes: mismo tono, distinto peso
const OTRAS_HEX = '#8a93a3' // agregado de tipos menores: neutro, no es un tipo más
const TINTA = '#1f2a3a', GRIS = '#5b6474', LINEA = '#e3e1ea', FONDO = '#f6f5f9'
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const nf = new Intl.NumberFormat('es-AR')

export const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

// ---- períodos (fechas ISO "AAAA-MM-DD", sin zona horaria) ----
const utc = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d) }
const isoDe = (t: number) => new Date(t).toISOString().slice(0, 10)
const DIA = 86400000
export const lunesDe = (iso: string) => { const t = utc(iso); return isoDe(t - ((new Date(t).getUTCDay() + 6) % 7) * DIA) }

export type Bucket = { clave: string, label: string, titulo: string }
export type Granularidad = 'semana' | 'mes'
// Hasta ~2 meses se agrupa por semana (el informe mensual también tiene evolución); más largo, por mes.
export const granularidad = (desde: string, hasta: string): Granularidad => ((utc(hasta) - utc(desde)) / DIA + 1 <= 62 ? 'semana' : 'mes')
const claveDe = (g: Granularidad, fecha: string) => (g === 'semana' ? lunesDe(fecha) : fecha.slice(0, 7))

export function buckets(desde: string, hasta: string): { g: Granularidad, lista: Bucket[] } {
  const g = granularidad(desde, hasta), lista: Bucket[] = []
  const variosAnios = desde.slice(0, 4) !== hasta.slice(0, 4)
  if (g === 'semana') {
    for (let t = utc(lunesDe(desde)); t <= utc(hasta); t += 7 * DIA) {
      const iso = isoDe(t), [, m, d] = iso.split('-')
      lista.push({ clave: iso, label: `${Number(d)}/${Number(m)}`, titulo: `Semana del ${Number(d)}/${Number(m)}` })
    }
  } else {
    let [y, m] = desde.split('-').map(Number)
    const [yf, mf] = hasta.split('-').map(Number)
    for (; y < yf || (y === yf && m <= mf); m === 12 ? (y++, m = 1) : m++) {
      const a = `${y}`.slice(2)
      lista.push({ clave: `${y}-${String(m).padStart(2, '0')}`, label: variosAnios ? `${MESES[m - 1]} ${a}` : MESES[m - 1], titulo: `${titleCase(MESES[m - 1])} de ${y}` })
    }
  }
  return { g, lista }
}

// ---- datos ----
const hechas = (items: AgendaItem[]) => items.filter(cuentaHecha)
export function porCategoria(items: AgendaItem[]): Record<Categoria, number> {
  const c: Record<Categoria, number> = { tecnica: 0, pedagogica: 0, institucional: 0 }
  for (const i of hechas(items)) { const k = CATEGORIA[i.accion]; if (k) c[k]++ }
  return c
}

export type PuntoAcciones = Bucket & { counts: Record<Categoria, number>, total: number }
export function evolucion(items: AgendaItem[], desde: string, hasta: string): { g: Granularidad, puntos: PuntoAcciones[] } {
  const { g, lista } = buckets(desde, hasta)
  const puntos = lista.map(b => ({ ...b, counts: { tecnica: 0, pedagogica: 0, institucional: 0 } as Record<Categoria, number>, total: 0 }))
  const por = new Map(puntos.map(p => [p.clave, p]))
  for (const i of hechas(items)) {
    const k = CATEGORIA[i.accion], p = por.get(claveDe(g, i.fecha))
    if (k && p) { p.counts[k]++; p.total++ }
  }
  return { g, puntos }
}

export type PuntoAsistencia = Bucket & { inscriptos: number, asistentes: number }
export type TotalesAsistencia = { encuentros: number, grupos: number, asistentes: number, inscriptos: number }
const promedio = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0)
// Cada grupo (club o práctica) aporta el promedio de asistentes de sus encuentros y su máximo de inscriptos (un grupo cuenta una vez, como en
// el indicador del informe): `asistentes` es el de un encuentro típico de cada grupo sumado, comparable con `inscriptos`. Los encuentros sin
// asistentes cargados no entran en el promedio. Los valores pueden tener decimales: se redondean al mostrarlos.
export function asistencia(items: AgendaItem[], desde: string, hasta: string): { g: Granularidad, puntos: PuntoAsistencia[], totales: TotalesAsistencia } {
  type Grupo = { asistentes: number[], inscriptos: number }
  const { g, lista } = buckets(desde, hasta)
  const puntos = lista.map(b => ({ ...b, inscriptos: 0, asistentes: 0 }))
  const por = new Map(puntos.map(p => [p.clave, { p, grupos: new Map<string, Grupo>() }]))
  const total = new Map<string, Grupo>()
  let encuentros = 0
  const de = (m: Map<string, Grupo>, k: string) => m.get(k) ?? (m.set(k, { asistentes: [], inscriptos: 0 }), m.get(k)!)
  for (const i of hechas(items).filter(x => x.accion === 'CLUB DE TECNOLOGÍA' || x.accion === 'PRÁCTICAS PROFESIONALIZANTES')) {
    for (const e of i.encuentros ?? []) {
      const b = por.get(claveDe(g, e.fecha))
      if (!b) continue
      const k = e.club_id ?? i.club_id ?? i.id
      for (const gr of [de(b.grupos, k), de(total, k)]) {
        if (e.asistentes !== null && e.asistentes !== undefined) gr.asistentes.push(e.asistentes)
        gr.inscriptos = Math.max(gr.inscriptos, e.inscriptos ?? 0)
      }
      encuentros++
    }
  }
  const suma = (m: Map<string, Grupo>, f: (x: Grupo) => number) => [...m.values()].reduce((a, x) => a + f(x), 0)
  for (const { p, grupos } of por.values()) { p.asistentes = suma(grupos, x => promedio(x.asistentes)); p.inscriptos = suma(grupos, x => x.inscriptos) }
  return { g, puntos, totales: { encuentros, grupos: total.size, asistentes: suma(total, x => promedio(x.asistentes)), inscriptos: suma(total, x => x.inscriptos) } }
}

// ---- SVG ----
// Cada gráfico es una tarjeta completa (fondo, título, gráfico y referencias) de ancho fijo: se ve igual en el PDF y como imagen en el Excel.
export type Tabla = { cabeza: string[], filas: (string | number)[][] }
export type Grafico = { clave: 'categorias' | 'tipos' | 'evolucion' | 'asistencia', titulo: string, svg: string, ancho: number, alto: number, tabla: Tabla }

const W = 360, PAD = 14, IW = W - PAD * 2, FUENTE = "'Encode Sans', Arial, sans-serif"
const t = (x: number, y: number, s: string, o: { size?: number, fill?: string, weight?: number, anchor?: 'start' | 'middle' | 'end', rotar?: number } = {}) =>
  `<text x="${x}" y="${y}" font-size="${o.size ?? 11}" fill="${o.fill ?? TINTA}"${o.weight ? ` font-weight="${o.weight}"` : ''}${o.anchor ? ` text-anchor="${o.anchor}"` : ''}${o.rotar ? ` transform="rotate(${o.rotar} ${x} ${y})"` : ''}>${esc(s)}</text>`
const cortar = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
const tarjeta = (clave: string, titulo: string, alto: number, cuerpo: string, resumen: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${alto}" width="${W}" height="${alto}" role="img" aria-label="${esc(`${titulo}. ${resumen}`)}" font-family="${FUENTE}" data-grafico="${clave}">` +
  `<title>${esc(titulo)}</title><rect x=".5" y=".5" width="${W - 1}" height="${alto - 1}" rx="10" fill="#fff" stroke="${LINEA}"/>${t(PAD, 26, titulo, { size: 12.5, weight: 700 })}${cuerpo}</svg>`
const ref = (x: number, y: number, color: string, texto: string) => `<rect x="${x}" y="${y - 9}" width="10" height="10" rx="2" fill="${color}"/>${t(x + 15, y, texto, { size: 10.5, fill: GRIS })}`

// 1. Mezcla por categoría: barra apilada con 2px entre segmentos y la referencia debajo, una por renglón.
function categorias(items: AgendaItem[]): Grafico | null {
  const c = porCategoria(items), total = CATEGORIAS.reduce((a, k) => a + c[k], 0)
  if (!total) return null
  const con = CATEGORIAS.filter(k => c[k]), util = IW - 2 * (con.length - 1)
  let x = PAD
  const barra = con.map(k => { const w = (c[k] / total) * util, r = `<rect x="${x.toFixed(2)}" y="42" width="${w.toFixed(2)}" height="18" rx="3" fill="${CAT_HEX[k]}"/>`; x += w + 2; return r }).join('')
  const pct = (n: number) => Math.round((n / total) * 100)
  const refs = CATEGORIAS.map((k, i) => ref(PAD, 84 + i * 18, CAT_HEX[k], `${CATEGORIA_LABEL[k]} · ${c[k]} (${pct(c[k])}%)`)).join('')
  const titulo = `Acciones por categoría (${nf.format(total)})`
  return { clave: 'categorias', titulo, ancho: W, alto: 142, svg: tarjeta('categorias', titulo, 142, barra + refs, CATEGORIAS.map(k => `${CATEGORIA_LABEL[k]} ${c[k]}`).join(', ')), tabla: { cabeza: ['Categoría', 'Acciones', '%'], filas: CATEGORIAS.map(k => [CATEGORIA_LABEL[k], c[k], `${pct(c[k])}%`]) } }
}

// 2. Acciones por tipo: barras horizontales ordenadas; los tipos menores se juntan en "Otras" (gris neutro).
function tipos(items: AgendaItem[]): Grafico | null {
  const todas = porTipo(items)
  if (!todas.length) return null
  const filas: [string, number][] = todas.length > 9
    ? [...todas.slice(0, 8).map(([k, v]) => [titleCase(k), v] as [string, number]), ['Otras', todas.slice(8).reduce((a, [, v]) => a + v, 0)]]
    : todas.map(([k, v]) => [titleCase(k), v] as [string, number])
  const max = Math.max(...filas.map(f => f[1])), X0 = 146, X1 = W - PAD - 30, alto = 44 + filas.length * 21 + 8
  const cuerpo = filas.map(([k, v], i) => {
    const y = 44 + i * 21
    return t(PAD, y + 11, cortar(k, 24), { size: 11 }) + `<rect x="${X0}" y="${y + 2}" width="${X1 - X0}" height="11" rx="3" fill="${FONDO}"/><rect x="${X0}" y="${y + 2}" width="${Math.max(2, ((v / max) * (X1 - X0))).toFixed(2)}" height="11" rx="3" fill="${k === 'Otras' ? OTRAS_HEX : CAT_HEX.tecnica}"/>` + t(W - PAD, y + 11, nf.format(v), { size: 11, weight: 700, anchor: 'end' })
  }).join('')
  return { clave: 'tipos', titulo: 'Acciones por tipo', ancho: W, alto, svg: tarjeta('tipos', 'Acciones por tipo', alto, cuerpo, filas.map(([k, v]) => `${k} ${v}`).join(', ')), tabla: { cabeza: ['Tipo', 'Acciones'], filas } }
}

// Eje vertical: hasta 4 intervalos con paso "redondo" (1, 2, 5 × 10ⁿ) y siempre enteros.
export function ejeValores(max: number): { tope: number, valores: number[] } {
  const bruto = Math.max(max, 1) / 4, mag = 10 ** Math.floor(Math.log10(bruto))
  const paso = Math.max(1, [1, 2, 5, 10].map(m => m * mag).find(p => p >= bruto)!)
  const tope = Math.ceil(Math.max(max, 1) / paso) * paso
  return { tope, valores: Array.from({ length: Math.round(tope / paso) + 1 }, (_, i) => i * paso) }
}

// Columnas con eje de valores y líneas de referencia; `n` barras repartidas en el ancho útil (los rótulos se inclinan si no entran).
const ALTO_COL = 118, Y_BASE = 46 + 14 + ALTO_COL, EJE_Y = 30 // 14 = lugar para el número sobre la barra más alta; EJE_Y = ancho de los valores del eje
function eje(labels: string[], max: number) {
  const { tope, valores } = ejeValores(max)
  const n = labels.length, larga = Math.max(...labels.map(l => l.length)) * 5.4
  const inclinar = larga > (IW - EJE_Y) / n
  const izq = EJE_Y + (inclinar ? 16 : 0) // los rótulos inclinados se extienden hacia la izquierda
  const paso = (IW - izq) / n, w = paso - 3
  const x = (i: number) => PAD + izq + i * paso + 1.5
  const h = (v: number) => (v / tope) * ALTO_COL
  const x0 = PAD + izq - 4
  const rejilla = valores.map(v => `<line x1="${x0}" y1="${(Y_BASE - h(v)).toFixed(2)}" x2="${W - PAD}" y2="${(Y_BASE - h(v)).toFixed(2)}" stroke="${v ? LINEA : GRIS}"/>` + t(x0 - 4, Y_BASE - h(v) + 3, nf.format(v), { size: 9, fill: GRIS, anchor: 'end' })).join('')
  const rotulos = labels.map((l, i) => inclinar ? t(x(i) + w / 2 + 3, Y_BASE + 12, l, { size: 9.5, fill: GRIS, anchor: 'end', rotar: -45 }) : t(x(i) + w / 2, Y_BASE + 13, l, { size: 9.5, fill: GRIS, anchor: 'middle' })).join('')
  const base = Y_BASE + 20 + (inclinar ? 16 : 0)
  return { w, x, h, cabe: (s: string) => s.length * 4.8 + 1 <= paso, dibujo: rejilla + rotulos, yRef: base + 14, yTotal: base + 32, alto: base + 30 + 20 }
}
const nombreColumna = (g: Granularidad) => (g === 'semana' ? 'Semana del' : 'Mes')

// 3. Evolución de acciones realizadas, apiladas por categoría (2px entre segmentos cuando hay lugar).
function evolucionGrafico(items: AgendaItem[], desde: string, hasta: string): Grafico | null {
  const { g, puntos } = evolucion(items, desde, hasta)
  if (puntos.length < 2 || !puntos.some(p => p.total)) return null
  const e = eje(puntos.map(p => p.label), Math.max(...puntos.map(p => p.total))), total = puntos.reduce((a, p) => a + p.total, 0)
  const barras = puntos.map((p, i) => {
    if (!p.total) return ''
    const con = CATEGORIAS.filter(k => p.counts[k]), H = e.h(p.total), gap = H >= 10 * con.length ? 2 : 0, util = H - gap * (con.length - 1)
    let y = Y_BASE
    const segs = con.map(k => { const hh = (p.counts[k] / p.total) * util; y -= hh; const r = `<rect x="${e.x(i).toFixed(2)}" y="${y.toFixed(2)}" width="${e.w.toFixed(2)}" height="${hh.toFixed(2)}" fill="${CAT_HEX[k]}"/>`; y -= gap; return r }).join('')
    return segs + (e.cabe(String(p.total)) ? t(e.x(i) + e.w / 2, Y_BASE - H - 4, String(p.total), { size: 9, anchor: 'middle' }) : '')
  }).join('')
  const refs = CATEGORIAS.map((k, j) => ref(PAD + [0, 84, 182][j], e.yRef, CAT_HEX[k], CATEGORIA_LABEL[k])).join('')
  const resumen = t(PAD, e.yTotal, `Total: ${nf.format(total)} ${total === 1 ? 'acción realizada' : 'acciones realizadas'}`, { size: 10.5, weight: 700 })
  const titulo = `Acciones por ${g}`
  return { clave: 'evolucion', titulo, ancho: W, alto: e.alto, svg: tarjeta('evolucion', titulo, e.alto, barras + e.dibujo + refs + resumen, puntos.map(p => `${p.label} ${p.total}`).join(', ')), tabla: { cabeza: [nombreColumna(g), ...CATEGORIAS.map(k => CATEGORIA_LABEL[k]), 'Total'], filas: puntos.map(p => [p.label, ...CATEGORIAS.map(k => p.counts[k]), p.total]) } }
}

// 4. Clubes y prácticas: inscriptos (ancho, claro) y asistentes (angosto, sólido), mismo azul.
function asistenciaGrafico(items: AgendaItem[], desde: string, hasta: string): Grafico | null {
  const { g, puntos, totales } = asistencia(items, desde, hasta)
  if (puntos.length < 2 || !puntos.some(p => p.inscriptos || p.asistentes)) return null
  const e = eje(puntos.map(p => p.label), Math.max(...puntos.map(p => Math.max(p.inscriptos, p.asistentes))))
  const barras = puntos.map((p, i) => {
    const m = Math.max(p.inscriptos, p.asistentes), num = nf.format(Math.round(p.asistentes))
    if (!m) return ''
    const H = e.h(m), Ha = e.h(p.asistentes)
    return `<rect x="${e.x(i).toFixed(2)}" y="${(Y_BASE - H).toFixed(2)}" width="${e.w.toFixed(2)}" height="${H.toFixed(2)}" fill="${INSCRIPTOS_HEX}"/>` +
      (p.asistentes ? `<rect x="${(e.x(i) + e.w * 0.22).toFixed(2)}" y="${(Y_BASE - Ha).toFixed(2)}" width="${(e.w * 0.56).toFixed(2)}" height="${Ha.toFixed(2)}" fill="${CAT_HEX.tecnica}"/>` : '') +
      (p.asistentes && e.cabe(num) ? t(e.x(i) + e.w / 2, Y_BASE - H - 4, num, { size: 9, anchor: 'middle' }) : '')
  }).join('')
  // Referencias y totales en dos filas cada uno: los textos son largos para una sola línea de 332 px.
  const refs = ref(PAD, e.yRef, INSCRIPTOS_HEX, 'Inscriptos (por grupo)') + ref(PAD, e.yRef + 16, CAT_HEX.tecnica, 'Asistentes (promedio por encuentro)')
  const l1 = `${nf.format(totales.encuentros)} ${totales.encuentros === 1 ? 'encuentro' : 'encuentros'} · ${nf.format(totales.grupos)} ${totales.grupos === 1 ? 'grupo' : 'grupos'}`
  const l2 = `Asistencia promedio: ${nf.format(Math.round(totales.asistentes))} de ${nf.format(Math.round(totales.inscriptos))} inscriptos${totales.inscriptos ? ` (${Math.round((totales.asistentes / totales.inscriptos) * 100)}%)` : ''}`
  const linea = `${l1}. ${l2}`
  const totalesSvg = t(PAD, e.yTotal + 16, l1, { size: 10, weight: 700 }) + t(PAD, e.yTotal + 30, l2, { size: 10, weight: 700 })
  const titulo = 'Clubes y prácticas: inscriptos y asistentes'
  const r = (n: number) => Math.round(n)
  return { clave: 'asistencia', titulo, ancho: W, alto: e.alto + 30, svg: tarjeta('asistencia', titulo, e.alto + 30, barras + e.dibujo + refs + totalesSvg, `${linea}. ${puntos.map(p => `${p.label} ${r(p.asistentes)} asistentes en promedio, ${r(p.inscriptos)} inscriptos`).join('; ')}`), tabla: { cabeza: [nombreColumna(g), 'Inscriptos', 'Asistentes (promedio por encuentro)'], filas: puntos.map(p => [p.label, r(p.inscriptos), r(p.asistentes)]) } }
}

// Los cuatro gráficos del informe (los que no tienen datos se omiten).
export function graficosInforme({ items, desde, hasta }: { items: AgendaItem[], desde: string, hasta: string }): Grafico[] {
  return [categorias(items), tipos(items), evolucionGrafico(items, desde, hasta), asistenciaGrafico(items, desde, hasta)].filter((x): x is Grafico => !!x)
}
