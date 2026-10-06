import { describe, expect, it } from 'vitest'
import { FILTROS_VACIOS, cuesDe, esDelFed, etiquetaTipo, fechaDe, filtrarCronogramas, haceDias, leerCronogramas, parsearCsv, resumenCronogramas, ventanaDe, type Cronograma } from '@/lib/cronogramas'

const ENC = 'ESTADO,PREDIO,Region,Fecha de Inicio,Fecha de Fin,Instalador Responsable,Proveedor,Cues involucrados,Nombre de las escuelas,Semana en que fue informado,Tipo,Distrito,Nro cronograma o incidencia,Descripcion de incidencia,Observaciones de territorio,Tipo de establecimiento'

describe('parsearCsv', () => {
  it('respeta comillas, comas y saltos de línea dentro de la celda', () => {
    expect(parsearCsv('a,"b, c","d\ne ""f"""\r\n1,2,3\n')).toEqual([['a', 'b, c', 'd\ne "f"'], ['1', '2', '3']])
  })
  it('ignora renglones vacíos', () => { expect(parsearCsv('a,b\n,\n\nc,d')).toEqual([['a', 'b'], ['c', 'd']]) })
})

describe('fechas y CUE', () => {
  it('fechaDe acepta d/m/aaaa con o sin ceros y rechaza lo inválido', () => {
    expect(fechaDe('6/10/2026')).toBe('2026-10-06')
    expect(fechaDe('06/10/2026')).toBe('2026-10-06')
    expect(fechaDe('31/02/2026')).toBeNull()
    expect(fechaDe('')).toBeNull()
    expect(fechaDe('hoy')).toBeNull()
  })
  it('cuesDe toma los de 8 dígitos, sin repetir', () => {
    expect(cuesDe('61457700 - 61520100')).toEqual([61457700, 61520100])
    expect(cuesDe('61457700, 61457700')).toEqual([61457700])
    expect(cuesDe('1234')).toEqual([])
  })
  it('haceDias resta días', () => { expect(haceDias('2026-10-06', 45)).toBe('2026-08-22') })
})

describe('leerCronogramas', () => {
  const fila = (o: Record<number, string>) => Array.from({ length: 16 }, (_, i) => o[i] ?? '').map(x => (/[,\n"]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x)).join(',')
  it('una fila por CUE, con instaladores uno por renglón', () => {
    const r = leerCronogramas([ENC, fila({ 3: '6/10/2026', 4: '20/10/2026', 5: 'Juan Pérez\nDNI 1', 6: 'PBA', 7: '61457700 - 61520100', 10: 'LAC_M', 12: '456914 - NI-1' })].join('\n'))
    expect(r.filas).toHaveLength(2)
    expect(r.filas[0]).toMatchObject({ cue: 61457700, fecha_inicio: '2026-10-06', fecha_fin: '2026-10-20', tipo: 'LAC_M', proveedor: 'PBA', instaladores: 'Juan Pérez\nDNI 1' })
  })
  it('descarta las filas sin fecha o sin CUE y cuenta los duplicados', () => {
    const f = fila({ 3: '6/10/2026', 4: '6/10/2026', 7: '61457700', 10: 'LAC', 12: '1' })
    const r = leerCronogramas([ENC, f, f, fila({ 7: '61457700' }), fila({ 3: '6/10/2026' })].join('\n'))
    expect(r.filas).toHaveLength(1); expect(r.duplicadas).toBe(1); expect(r.descartadas).toBe(2)
  })
  it('falla con un mensaje claro si cambiaron los encabezados', () => {
    expect(() => leerCronogramas('A,B\n1,2')).toThrow(/La planilla cambió/)
  })
})

describe('filtros de la sección', () => {
  const c = (o: Partial<Cronograma>): Cronograma => ({ id: '1', cue: 1, fecha_inicio: '2026-10-06', fecha_fin: '2026-10-10', tipo: 'LAC_M', proveedor: 'PBA', nro: null, semana: null, estado_planilla: null, instaladores: null, descripcion: null, observaciones: null, nombre_planilla: null, primera_vez_at: '', actualizado_at: '', school: { id: 's', nombre: 'EES N° 1', distrito: 'LA PLATA', ciudad: null, fed_a_cargo: 'Macarena Duarte Buschiazzo' }, ...o })
  it('esDelFed compara el nombre del perfil con el de la base', () => {
    expect(esDelFed('Macarena Duarte Buschiazzo', 'Macarena Duarte')).toBe(true)
    expect(esDelFed('Marcos Pettiná', 'Macarena Duarte')).toBe(false)
    expect(esDelFed(null, 'Macarena Duarte')).toBe(false)
  })
  const lista = [c({ id: 'a' }), c({ id: 'b', fecha_fin: '2026-09-01', fecha_inicio: '2026-09-01' }), c({ id: 'c', school: { id: 's', nombre: 'EP 2', distrito: 'BERISSO', ciudad: null, fed_a_cargo: 'Sin FED asignado' }, tipo: 'LAC' })]
  it('separa próximos y pasados', () => {
    expect(filtrarCronogramas(lista, FILTROS_VACIOS, '2026-10-06').map(x => x.id)).toEqual(['a', 'c'])
    expect(filtrarCronogramas(lista, { ...FILTROS_VACIOS, pestana: 'pasados' }, '2026-10-06').map(x => x.id)).toEqual(['b'])
    expect(filtrarCronogramas(lista, { ...FILTROS_VACIOS, pestana: 'todos' }, '2026-10-06')).toHaveLength(3)
  })
  it('filtra por distrito, FED, tipo y búsqueda', () => {
    expect(filtrarCronogramas(lista, { ...FILTROS_VACIOS, distrito: 'berisso' }, '2026-10-06').map(x => x.id)).toEqual(['c'])
    expect(filtrarCronogramas(lista, { ...FILTROS_VACIOS, fed: 'Sin FED asignado' }, '2026-10-06').map(x => x.id)).toEqual(['c'])
    expect(filtrarCronogramas(lista, { ...FILTROS_VACIOS, fed: 'Macarena Duarte' }, '2026-10-06').map(x => x.id)).toEqual(['a'])
    expect(filtrarCronogramas(lista, { ...FILTROS_VACIOS, tipo: 'LAC' }, '2026-10-06').map(x => x.id)).toEqual(['c'])
    expect(filtrarCronogramas(lista, { ...FILTROS_VACIOS, busqueda: 'instalación de piso' }, '2026-10-06').map(x => x.id)).toEqual(['c'])
  })
  it('resume y formatea', () => {
    expect(resumenCronogramas(lista, '2026-10-06')).toMatchObject({ proximos: 2, pasados: 1, sinFed: 1 })
    expect(ventanaDe({ fecha_inicio: '2026-10-06', fecha_fin: '2026-10-20' })).toBe('06/10 al 20/10')
    expect(ventanaDe({ fecha_inicio: '2026-10-06', fecha_fin: '2026-10-06' })).toBe('06/10')
    expect(etiquetaTipo('LAC_R')).toBe('Reparación de piso')
    expect(etiquetaTipo(null)).toBe('Sin tipo')
  })
})
