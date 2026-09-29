import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { AgendaItem } from '@/lib/agenda'
import { CAT_HEX, asistencia, buckets, esc, evolucion, granularidad, graficosInforme, lunesDe, porCategoria } from '@/lib/graficos'

let n = 0
const item = (accion: string, fecha: string, extra: Record<string, unknown> = {}) => ({ id: `i${++n}`, accion, fecha, estado: 'realizada', fed_id: 'f1', club_id: null, encuentros: [], ...extra }) as unknown as AgendaItem
const enc = (fecha: string, inscriptos: number | null, asistentes: number | null, club_id: string | null = 'c1') => ({ fecha, inscriptos, asistentes, club_id })

describe('períodos', () => {
  it('hasta ~2 meses se agrupa por semana; más largo, por mes', () => {
    expect(granularidad('2026-09-01', '2026-09-30')).toBe('semana')
    expect(granularidad('2026-08-01', '2026-09-30')).toBe('semana')
    expect(granularidad('2026-03-01', '2026-09-30')).toBe('mes')
  })
  it('la semana empieza el lunes', () => {
    expect(lunesDe('2026-09-01')).toBe('2026-08-31') // martes
    expect(lunesDe('2026-08-31')).toBe('2026-08-31')
    expect(lunesDe('2026-09-06')).toBe('2026-08-31') // domingo
  })
  it('semanas: cubre todo el período, sin huecos', () => {
    const { g, lista } = buckets('2026-09-01', '2026-09-30')
    expect(g).toBe('semana')
    expect(lista.map(b => b.clave)).toEqual(['2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28'])
    expect(lista[0].label).toBe('31/8')
  })
  it('meses: cruza el fin de año y agrega el año al rótulo', () => {
    const { g, lista } = buckets('2026-11-01', '2027-02-28')
    expect(g).toBe('mes')
    expect(lista.map(b => b.clave)).toEqual(['2026-11', '2026-12', '2027-01', '2027-02'])
    expect(lista.map(b => b.label)).toEqual(['nov 26', 'dic 26', 'ene 27', 'feb 27'])
  })
})

describe('datos', () => {
  const items = [
    item('VISITA TÉCNICA', '2026-09-02'), item('VISITA TÉCNICA', '2026-09-03', { estado: 'planificada' }),
    item('CLUB DE TECNOLOGÍA', '2026-09-09'), item('REUNIÓN', '2026-09-10'), item('LICENCIA', '2026-09-11'),
  ]
  it('cuenta sólo acciones realizadas y de trabajo (no licencias ni planificadas)', () => {
    expect(porCategoria(items)).toEqual({ tecnica: 1, pedagogica: 1, institucional: 1 })
  })
  it('evolución: cada acción va a su semana y categoría', () => {
    const { puntos } = evolucion(items, '2026-09-01', '2026-09-30')
    expect(puntos.map(p => p.total)).toEqual([1, 2, 0, 0, 0])
    expect(puntos[1].counts).toEqual({ tecnica: 0, pedagogica: 1, institucional: 1 })
  })
  it('evolución: lo que cae fuera del período no se cuenta', () => {
    const { puntos } = evolucion([item('REUNIÓN', '2026-10-15')], '2026-09-01', '2026-09-30')
    expect(puntos.reduce((a, p) => a + p.total, 0)).toBe(0)
  })
  it('asistencia: suma asistentes y toma el máximo de inscriptos de cada grupo', () => {
    const it1 = item('CLUB DE TECNOLOGÍA', '2026-09-02', { encuentros: [enc('2026-09-02', 30, 20), enc('2026-09-03', 34, 25)] })
    const it2 = item('PRÁCTICAS PROFESIONALIZANTES', '2026-09-03', { encuentros: [enc('2026-09-03', 10, null, 'c2')] })
    const { puntos } = asistencia([it1, it2, item('REUNIÓN', '2026-09-02', { encuentros: [enc('2026-09-02', 99, 99)] })], '2026-09-01', '2026-09-30')
    expect(puntos[0]).toMatchObject({ asistentes: 45, inscriptos: 44 })
    expect(puntos.slice(1).every(p => p.asistentes === 0 && p.inscriptos === 0)).toBe(true)
  })
})

describe('SVG de los gráficos', () => {
  const items = [item('VISITA TÉCNICA', '2026-09-02'), item('CLUB DE TECNOLOGÍA', '2026-09-09', { encuentros: [enc('2026-09-09', 30, 20)] })]
  const periodo = { desde: '2026-09-01', hasta: '2026-09-30' }
  it('sin datos no arma nada', () => {
    expect(graficosInforme({ items: [], ...periodo })).toEqual([])
  })
  it('con datos arma los cuatro gráficos, cada uno un SVG completo', () => {
    const g = graficosInforme({ items, ...periodo })
    expect(g.map(x => x.clave)).toEqual(['categorias', 'tipos', 'evolucion', 'asistencia'])
    for (const x of g) {
      expect(x.svg.startsWith('<svg ')).toBe(true)
      expect(x.svg.endsWith('</svg>')).toBe(true)
      expect(x.svg).toContain(`viewBox="0 0 ${x.ancho} ${x.alto}"`)
      expect(x.svg).not.toMatch(/class=|var\(--/) // autocontenido: sin clases ni variables CSS
      expect(x.tabla.filas.length).toBeGreaterThan(0)
    }
  })
  it('la evolución usa semana o mes según el período', () => {
    expect(graficosInforme({ items, ...periodo }).find(x => x.clave === 'evolucion')!.titulo).toBe('Acciones por semana')
    expect(graficosInforme({ items, desde: '2026-03-01', hasta: '2026-09-30' }).find(x => x.clave === 'evolucion')!.titulo).toBe('Acciones por mes')
  })
  it('un período de una sola semana no arma evolución ni asistencia (menos de dos barras)', () => {
    const g = graficosInforme({ items, desde: '2026-09-07', hasta: '2026-09-13' })
    expect(g.map(x => x.clave)).toEqual(['categorias', 'tipos'])
  })
  it('más de 9 tipos: los menores se juntan en "Otras"', () => {
    const muchos = ['VISITA TÉCNICA', 'VISITA PEDAGÓGICA', 'REUNIÓN', 'CLUB DE TECNOLOGÍA', 'PRÁCTICAS PROFESIONALIZANTES', 'TALLER/CAPACITACIÓN', 'ASISTENCIA REMOTA', 'CONECTIVIDAD', 'ADMINISTRATIVO', 'EVENTO DTE', 'PLANIFICACIÓN'].map(a => item(a, '2026-09-02'))
    const tipos = graficosInforme({ items: muchos, ...periodo }).find(x => x.clave === 'tipos')!
    expect(tipos.tabla.filas).toHaveLength(9)
    expect(tipos.tabla.filas.at(-1)).toEqual(['Otras', 3])
  })
  it('escapa el texto', () => expect(esc('<b>"a" & b</b>')).toBe('&lt;b&gt;&quot;a&quot; &amp; b&lt;/b&gt;'))
  it('los colores coinciden con los de la app (globals.css)', () => {
    const css = readFileSync('app/globals.css', 'utf8')
    for (const [k, hex] of Object.entries(CAT_HEX)) expect(css).toContain(`--color-cat-${k}: ${hex};`)
  })
})
