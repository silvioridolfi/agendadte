// Gráficos de los informes (CED y FED). Un solo generador de HTML con estilos en línea, para que se vea igual en pantalla y en el PDF
// (la ventana del PDF no tiene las clases ni las variables de la app). Todo texto dinámico se escapa.
import { CATEGORIA, CATEGORIA_LABEL, CATEGORIAS, type AgendaItem, type Categoria, cuentaHecha } from '@/lib/agenda'
import { porTipo } from '@/lib/informes'
import { titleCase } from '@/lib/format'

// Mismos colores que --color-cat-* de globals.css (validados con la guía de dataviz); un test verifica que coincidan.
export const CAT_HEX: Record<Categoria, string> = { tecnica: '#2a6fb0', pedagogica: '#d41c6c', institucional: '#6f5fc2' }
const INSCRIPTOS_HEX = '#b7d0e8' // tinte del azul de asistentes: mismo tono, distinto peso
const OTRAS_HEX = '#8a93a3' // agregado de tipos menores: neutro, no es un tipo más
const TINTA = '#1f2a3a', GRIS = '#5b6474', LINEA = '#e3e1ea', FONDO = '#f6f5f9', PETROLEO = '#05476e'
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
// Inscriptos: el máximo registrado de cada grupo en el período (un grupo cuenta una vez, como en el indicador del informe).
export function asistencia(items: AgendaItem[], desde: string, hasta: string): { g: Granularidad, puntos: PuntoAsistencia[] } {
  const { g, lista } = buckets(desde, hasta)
  const puntos = lista.map(b => ({ ...b, inscriptos: 0, asistentes: 0 }))
  const por = new Map(puntos.map(p => [p.clave, { p, clubes: new Map<string, number>() }]))
  for (const i of hechas(items).filter(x => x.accion === 'CLUB DE TECNOLOGÍA' || x.accion === 'PRÁCTICAS PROFESIONALIZANTES')) {
    for (const e of i.encuentros ?? []) {
      const b = por.get(claveDe(g, e.fecha))
      if (!b) continue
      b.p.asistentes += e.asistentes ?? 0
      const k = e.club_id ?? i.club_id ?? i.id
      b.clubes.set(k, Math.max(b.clubes.get(k) ?? 0, e.inscriptos ?? 0))
    }
  }
  for (const { p, clubes } of por.values()) p.inscriptos = [...clubes.values()].reduce((a, b) => a + b, 0)
  return { g, puntos }
}

// ---- HTML ----
const marco = (titulo: string, cuerpo: string, tabla = '') =>
  `<div style="break-inside:avoid;border:1px solid ${LINEA};border-radius:12px;padding:12px 14px;background:#fff;min-width:0"><p style="margin:0 0 10px;font-weight:700;font-size:13px;line-height:1.3;color:${TINTA}">${esc(titulo)}</p>${cuerpo}${tabla}</div>`
const leyenda = (items: { color: string, texto: string }[]) =>
  `<ul style="list-style:none;margin:8px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:4px 14px;font-size:11px;color:${GRIS}">${items.map(x => `<li style="display:flex;align-items:center;gap:5px"><span style="width:10px;height:10px;border-radius:2px;background:${x.color};display:inline-block"></span>${esc(x.texto)}</li>`).join('')}</ul>`
const tablaVer = (cabeza: string[], filas: (string | number)[][]) =>
  `<details style="margin-top:8px"><summary style="cursor:pointer;font-size:12px;color:${PETROLEO};font-weight:600">Ver como tabla</summary><table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:6px"><thead><tr>${cabeza.map((h, i) => `<th style="text-align:${i ? 'right' : 'left'};padding:3px 6px;border-bottom:1px solid ${LINEA};color:${GRIS};font-weight:600">${esc(h)}</th>`).join('')}</tr></thead><tbody>${filas.map(f => `<tr>${f.map((c, i) => `<td style="text-align:${i ? 'right' : 'left'};padding:3px 6px;border-bottom:1px solid ${LINEA}">${esc(String(c))}</td>`).join('')}</tr>`).join('')}</tbody></table></details>`

// 1. Mezcla por categoría: barra apilada con 2px entre segmentos.
function graficoCategorias(items: AgendaItem[], tabla: boolean) {
  const c = porCategoria(items), total = CATEGORIAS.reduce((a, k) => a + c[k], 0)
  if (!total) return ''
  const desc = CATEGORIAS.map(k => `${CATEGORIA_LABEL[k]}: ${c[k]}`).join(', ')
  const barra = `<div role="img" aria-label="${esc(desc)}" style="display:flex;gap:2px;height:16px;border-radius:4px;overflow:hidden">${CATEGORIAS.filter(k => c[k]).map(k => `<div title="${esc(`${CATEGORIA_LABEL[k]}: ${c[k]}`)}" style="flex:${c[k]} 1 0;background:${CAT_HEX[k]}"></div>`).join('')}</div>`
  const pct = (n: number) => Math.round((n / total) * 100)
  const ley = leyenda(CATEGORIAS.map(k => ({ color: CAT_HEX[k], texto: `${CATEGORIA_LABEL[k]} · ${c[k]} (${pct(c[k])}%)` })))
  return marco(`Acciones realizadas por categoría (${nf.format(total)})`, barra + ley, tabla ? tablaVer(['Categoría', 'Acciones', '%'], CATEGORIAS.map(k => [CATEGORIA_LABEL[k], c[k], `${pct(c[k])}%`])) : '')
}

// 2. Acciones por tipo: barras horizontales ordenadas; el resto se junta en "Otras".
function graficoTipos(items: AgendaItem[], tabla: boolean) {
  const todas = porTipo(items)
  if (!todas.length) return ''
  const filas = todas.length > 9 ? [...todas.slice(0, 8).map(([k, v]) => [titleCase(k), v] as [string, number]), ['Otras', todas.slice(8).reduce((a, [, v]) => a + v, 0)] as [string, number]] : todas.map(([k, v]) => [titleCase(k), v] as [string, number])
  const max = Math.max(...filas.map(f => f[1]))
  const barras = `<div style="display:flex;flex-direction:column;gap:7px">${filas.map(([k, v]) => `<div title="${esc(`${k}: ${v}`)}" style="display:grid;grid-template-columns:minmax(0,8.5rem) 1fr auto;align-items:center;gap:8px;font-size:12px"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:${TINTA}">${esc(k)}</span><span style="display:block;height:10px;background:${FONDO};border-radius:0 4px 4px 0"><span style="display:block;height:100%;width:${(v / max) * 100}%;background:${k === 'Otras' ? OTRAS_HEX : CAT_HEX.tecnica};border-radius:0 4px 4px 0"></span></span><b style="font-variant-numeric:tabular-nums;color:${TINTA}">${nf.format(v)}</b></div>`).join('')}</div>`
  return marco('Acciones realizadas por tipo', barras, tabla ? tablaVer(['Tipo', 'Acciones'], filas.map(([k, v]) => [k, v])) : '')
}

const ALTO = 140, ROTULO = 14
// Columnas: el contenedor tiene alto fijo; cada columna deja lugar arriba para el número.
const columnas = (cols: { titulo: string, label: string, numero: string, relleno: string }[]) =>
  `<div style="display:flex;align-items:flex-end;gap:3px;height:${ALTO}px;border-bottom:1px solid ${GRIS}">${cols.map(c => `<div title="${esc(c.titulo)}" style="flex:1 1 0;min-width:0;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center"><span style="height:${ROTULO}px;line-height:${ROTULO}px;font-size:10px;color:${TINTA}">${esc(c.numero)}</span>${c.relleno}</div>`).join('')}</div>` +
  `<div style="display:flex;gap:3px;margin-top:3px">${cols.map(c => `<span style="flex:1 1 0;min-width:0;text-align:center;font-size:10px;color:${GRIS};white-space:nowrap;overflow:hidden">${esc(c.label)}</span>`).join('')}</div>`

// 3. Evolución de acciones realizadas, apiladas por categoría.
function graficoEvolucion(items: AgendaItem[], desde: string, hasta: string, tabla: boolean) {
  const { g, puntos } = evolucion(items, desde, hasta)
  if (puntos.length < 2 || !puntos.some(p => p.total)) return ''
  const max = Math.max(...puntos.map(p => p.total)), nums = puntos.length <= 14
  const cols = puntos.map(p => ({
    titulo: `${p.titulo}: ${p.total} ${p.total === 1 ? 'acción' : 'acciones'}${p.total ? ` (${CATEGORIAS.filter(k => p.counts[k]).map(k => `${CATEGORIA_LABEL[k]} ${p.counts[k]}`).join(', ')})` : ''}`,
    label: p.label, numero: nums && p.total ? String(p.total) : '',
    relleno: p.total ? `<div style="width:100%;height:calc((100% - ${ROTULO}px) * ${p.total / max});display:flex;flex-direction:column-reverse;gap:2px;border-radius:3px 3px 0 0;overflow:hidden">${CATEGORIAS.filter(k => p.counts[k]).map(k => `<div style="flex:${p.counts[k]} 1 0;background:${CAT_HEX[k]}"></div>`).join('')}</div>` : '',
  }))
  const ley = leyenda(CATEGORIAS.map(k => ({ color: CAT_HEX[k], texto: CATEGORIA_LABEL[k] })))
  return marco(`Acciones realizadas por ${g}`, columnas(cols) + ley, tabla ? tablaVer([g === 'semana' ? 'Semana del' : 'Mes', ...CATEGORIAS.map(k => CATEGORIA_LABEL[k]), 'Total'], puntos.map(p => [p.label, ...CATEGORIAS.map(k => p.counts[k]), p.total])) : '')
}

// 4. Clubes y prácticas: inscriptos (ancho, claro) y asistentes (angosto, sólido), mismo azul.
function graficoAsistencia(items: AgendaItem[], desde: string, hasta: string, tabla: boolean) {
  const { g, puntos } = asistencia(items, desde, hasta)
  if (puntos.length < 2 || !puntos.some(p => p.inscriptos || p.asistentes)) return ''
  const max = Math.max(...puntos.map(p => Math.max(p.inscriptos, p.asistentes))), nums = puntos.length <= 10
  const cols = puntos.map(p => {
    const m = Math.max(p.inscriptos, p.asistentes)
    return {
      titulo: `${p.titulo}: ${nf.format(p.asistentes)} asistentes de ${nf.format(p.inscriptos)} inscriptos`,
      label: p.label, numero: nums && p.asistentes ? nf.format(p.asistentes) : '',
      relleno: m ? `<div style="position:relative;width:100%;height:calc((100% - ${ROTULO}px) * ${m / max});background:${INSCRIPTOS_HEX};border-radius:3px 3px 0 0"><div style="position:absolute;left:22%;right:22%;bottom:0;height:${(p.asistentes / m) * 100}%;background:${CAT_HEX.tecnica};border-radius:3px 3px 0 0"></div></div>` : '',
    }
  })
  const ley = leyenda([{ color: INSCRIPTOS_HEX, texto: 'Inscriptos' }, { color: CAT_HEX.tecnica, texto: 'Asistentes' }])
  return marco(`Clubes y prácticas: inscriptos y asistentes por ${g}`, columnas(cols) + ley, tabla ? tablaVer([g === 'semana' ? 'Semana del' : 'Mes', 'Inscriptos', 'Asistentes'], puntos.map(p => [p.label, p.inscriptos, p.asistentes])) : '')
}

// Los cuatro gráficos del informe (los que no tienen datos se omiten). `tabla`: agrega "Ver como tabla" (en pantalla; el PDF no la lleva).
export function graficosInforme({ items, desde, hasta, tabla }: { items: AgendaItem[], desde: string, hasta: string, tabla: boolean }): { html: string, hay: boolean } {
  const partes = [graficoCategorias(items, tabla), graficoTipos(items, tabla), graficoEvolucion(items, desde, hasta, tabla), graficoAsistencia(items, desde, hasta, tabla)].filter(Boolean)
  return { hay: partes.length > 0, html: `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:12px;font-family:inherit">${partes.join('')}</div>` }
}
