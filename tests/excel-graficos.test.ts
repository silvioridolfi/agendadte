import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import type { AgendaItem } from '@/lib/agenda'
import { agregarHojaGraficos } from '@/lib/exportar'
import { graficosInforme } from '@/lib/graficos'

// PNG de 1 × 1 px (alcanza para comprobar que la imagen viaja dentro del archivo).
const PNG = (() => { const b = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer })()

let n = 0
const item = (accion: string, fecha: string, extra: Record<string, unknown> = {}) => ({ id: `i${++n}`, accion, fecha, estado: 'realizada', fed_id: 'f1', club_id: null, encuentros: [], ...extra }) as unknown as AgendaItem
const enc = (fecha: string, inscriptos: number, asistentes: number, club_id = 'c1') => ({ fecha, inscriptos, asistentes, club_id })
const items = [
  item('VISITA TÉCNICA', '2026-09-02'), item('REUNIÓN', '2026-09-10'), item('VISITA PEDAGÓGICA', '2026-09-16'),
  item('CLUB DE TECNOLOGÍA', '2026-09-09', { encuentros: [enc('2026-09-09', 30, 20), enc('2026-09-16', 30, 25)] }),
]
const graficos = graficosInforme({ items, desde: '2026-09-01', hasta: '2026-09-30' })

describe('hoja "Gráficos" del Excel', () => {
  it('hay cuatro gráficos para probar', () => expect(graficos.map(g => g.clave)).toEqual(['categorias', 'tipos', 'evolucion', 'asistencia']))

  it('cada gráfico va como imagen, con su tabla de números a la derecha', () => {
    const wb = new ExcelJS.Workbook()
    const ws = agregarHojaGraficos(wb, graficos, graficos.map(() => PNG))
    expect(ws.name).toBe('Gráficos')
    expect(ws.getImages()).toHaveLength(4)
    const colI = ws.getColumn(9).values.filter(Boolean).map(String)
    for (const g of graficos) expect(colI).toContain(g.titulo)
    for (const g of graficos) for (const h of g.tabla.cabeza) expect(ws.getRows(1, ws.rowCount)!.some(r => r.values && (r.values as unknown[]).includes(h))).toBe(true)
  })

  it('los números de las tablas son números (se pueden editar y graficar en Excel)', () => {
    const wb = new ExcelJS.Workbook()
    const ws = agregarHojaGraficos(wb, graficos, graficos.map(() => PNG))
    const tipos = graficos.find(g => g.clave === 'tipos')!
    const fila = ws.getRows(1, ws.rowCount)!.find(r => r.getCell(9).value === tipos.tabla.filas[0][0] && typeof r.getCell(10).value === 'number')
    expect(fila?.getCell(10).value).toBe(tipos.tabla.filas[0][1])
  })

  it('las imágenes no se pisan con la tabla ni entre sí', () => {
    const wb = new ExcelJS.Workbook()
    const ws = agregarHojaGraficos(wb, graficos, graficos.map(() => PNG))
    const filas = ws.getImages().map(i => (i.range.tl as { nativeRow: number }).nativeRow)
    expect(filas).toEqual([...filas].sort((a, b) => a - b))
    expect(new Set(filas).size).toBe(4)
    for (const i of ws.getImages()) expect((i.range.tl as { nativeCol: number }).nativeCol).toBe(0) // a la izquierda de la tabla (columna I)
  })

  it('si el navegador no pudo armar las imágenes, quedan las tablas y un aviso', () => {
    const wb = new ExcelJS.Workbook()
    const ws = agregarHojaGraficos(wb, graficos, [PNG, null, PNG, null])
    expect(ws.getImages()).toHaveLength(2)
    expect(String(ws.getCell('A2').value)).toContain('no se pudieron generar')
    expect(ws.getColumn(9).values.map(String)).toContain(graficos[1].titulo)
  })

  it('sin problemas no hay aviso', () => {
    const ws = agregarHojaGraficos(new ExcelJS.Workbook(), graficos, graficos.map(() => PNG))
    expect(ws.getCell('A2').value).toBeNull()
  })

  it('el archivo .xlsx lleva las imágenes dentro y se vuelve a abrir bien', async () => {
    const wb = new ExcelJS.Workbook()
    agregarHojaGraficos(wb, graficos, graficos.map(() => PNG))
    const buf = await wb.xlsx.writeBuffer()
    const leido = new ExcelJS.Workbook()
    await leido.xlsx.load(buf as ArrayBuffer)
    const ws = leido.getWorksheet('Gráficos')!
    expect(ws.getImages()).toHaveLength(4)
    expect(ws.getCell('A1').value).toBe('Gráficos del período')
  })
})
