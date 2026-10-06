import { describe, expect, it } from 'vitest'
import { FILTROS_ESCUELAS_VACIOS, armarResumen, filtrarEscuelas, resumenEscuelas } from '@/lib/mis-escuelas'

const base = (id: string, cue: number, nombre: string, distrito: string, fed: string | null, nivel = 'Secundario') => ({ id, cue, nombre, distrito, ciudad: distrito, nivel, modalidad: null, fed_a_cargo: fed })
const escuelas = [
  base('a', 61000001, 'ESCUELA DE EDUCACIÓN SECUNDARIA N° 31', 'LA PLATA', 'Jorge Pérez'),
  base('b', 61000002, 'ESCUELA PRIMARIA N° 4 LEANDRO N. ALEM', 'BERISSO', 'Jorge Pérez', 'Primario'),
  base('c', 61000003, 'ESCUELA ESPECIAL N° 501', 'LA PLATA', 'Sin FED asignado', 'Especial'),
  base('d', 61000004, 'JARDÍN DE INFANTES N° 902', 'ENSENADA', null, 'Inicial'),
]
const hoy = '2026-10-06'
const resumen = armarResumen(escuelas, {
  cronogramas: [
    { school_id: 'a', fecha_inicio: '2026-10-12', fecha_fin: '2026-10-16', tipo: 'LAC_M' }, { school_id: 'a', fecha_inicio: '2026-10-08', fecha_fin: '2026-10-09', tipo: 'LAC' },
    { school_id: 'b', fecha_inicio: '2026-08-01', fecha_fin: '2026-08-05', tipo: 'LAC_M' }, { school_id: null, fecha_inicio: '2026-10-12', fecha_fin: '2026-10-12', tipo: 'LAC' },
  ],
  reclamos: [{ school_id: 'b' }, { school_id: 'b' }, { school_id: 'c' }],
  acciones: [
    { school_id: 'a', fecha: '2026-09-20', estado: 'realizada' }, { school_id: 'a', fecha: '2026-10-01', estado: 'realizada' }, { school_id: 'a', fecha: '2026-10-20', estado: 'planificada' }, { school_id: 'a', fecha: '2026-10-10', estado: 'planificada' },
    { school_id: 'b', fecha: '2026-10-20', estado: 'realizada' },
  ],
}, hoy)

describe('armarResumen', () => {
  it('cuenta los cronogramas vigentes y toma el que empieza primero', () => {
    expect(resumen[0].cronogramas).toBe(2)
    expect(resumen[0].proximoCronograma).toMatchObject({ fecha_inicio: '2026-10-08', tipo: 'LAC' })
    expect(resumen[1].cronogramas).toBe(0); expect(resumen[1].proximoCronograma).toBeNull()
  })
  it('cuenta los reclamos abiertos', () => { expect(resumen.map(r => r.reclamosAbiertos)).toEqual([0, 2, 1, 0]) })
  it('última visita realizada y próxima acción planificada', () => {
    expect(resumen[0].ultimaVisita).toBe('2026-10-01'); expect(resumen[0].proximaAccion).toBe('2026-10-10')
    expect(resumen[1].ultimaVisita).toBeNull()
    expect(resumen[3].ultimaVisita).toBeNull(); expect(resumen[3].proximaAccion).toBeNull()
  })
})

describe('filtrarEscuelas', () => {
  const f = (o: Partial<typeof FILTROS_ESCUELAS_VACIOS>) => filtrarEscuelas(resumen, { ...FILTROS_ESCUELAS_VACIOS, ...o }).map(e => e.id)
  it('busca por sigla, nombre, CUE y distrito, sin tildes', () => {
    expect(f({ busqueda: 'ees 31' })).toEqual(['a'])
    expect(f({ busqueda: 'EP 4' })).toEqual(['b'])
    expect(f({ busqueda: 'leandro alem' })).toEqual(['b'])
    expect(f({ busqueda: '61000004' })).toEqual(['d'])
    expect(f({ busqueda: 'jardin' })).toEqual(['d'])
    expect(f({ busqueda: 'berisso' })).toEqual(['b'])
  })
  it('filtra por distrito, nivel, FED, cronograma y reclamo', () => {
    expect(f({ distrito: 'la plata' })).toEqual(['a', 'c'])
    expect(f({ nivel: 'Primario' })).toEqual(['b'])
    expect(f({ fed: 'Jorge Pérez' })).toEqual(['a', 'b'])
    expect(f({ fed: 'Sin FED asignado' })).toEqual(['c', 'd'])
    expect(f({ conCronograma: true })).toEqual(['a'])
    expect(f({ conReclamo: true })).toEqual(['c', 'b'])
  })
  it('ordena por nombre', () => { expect(f({})).toEqual(['a', 'c', 'b', 'd']) })
  it('resume', () => { expect(resumenEscuelas(resumen)).toEqual({ total: 4, conCronograma: 1, conReclamo: 2 }) })
})
