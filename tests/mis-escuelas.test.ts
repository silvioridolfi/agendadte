import { describe, expect, it } from 'vitest'
import { FILTROS_ESCUELAS_VACIOS, armarResumen, contarAccesos, elegirContacto, filtrarEscuelas, nombreContacto, ordenarEscuelas, resumenEscuelas } from '@/lib/mis-escuelas'

const base = (id: string, cue: number, nombre: string, distrito: string, fed: string | null, nivel = 'Secundario', direccion: string | null = null) => ({ id, cue, nombre, distrito, ciudad: distrito, nivel, modalidad: null, fed_a_cargo: fed, direccion })
const escuelas = [
  base('a', 61000001, 'ESCUELA DE EDUCACIÓN SECUNDARIA N° 31', 'LA PLATA', 'Jorge Pérez'),
  base('b', 61000002, 'ESCUELA PRIMARIA N° 4 LEANDRO N. ALEM', 'BERISSO', 'Jorge Pérez', 'Primario'),
  base('c', 61000003, 'ESCUELA ESPECIAL N° 501', 'LA PLATA', 'Sin FED asignado', 'Especial'),
  base('d', 61000004, 'JARDÍN DE INFANTES N° 902', 'ENSENADA', null, 'Inicial', 'CALLE 5 Y 120'),
]
const hoy = '2026-10-06'
const ct = (cue: number, nombre: string, extra: Partial<{ apellido: string, telefono: string, correo: string, es_principal: boolean }> = {}) => ({ cue, nombre, apellido: null, cargo: 'Directora', telefono: null, correo: null, correo_laboral: null, es_principal: false, ...extra })
const resumen = armarResumen(escuelas, {
  contactos: [ct(61000001, 'Ana', { apellido: 'Gómez', telefono: '221 555-0101', correo: 'ees31@abc.gob.ar' }), ct(61000001, 'Luis', { es_principal: true, apellido: 'Pérez' }), ct(61000004, 'Marisol'), ct(61000002, '')],
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
  it('lista los cronogramas que no terminaron, del primero al último', () => {
    expect(resumen[0].proximosCronogramas).toEqual([{ fecha_inicio: '2026-10-08', fecha_fin: '2026-10-09', tipo: 'LAC' }, { fecha_inicio: '2026-10-12', fecha_fin: '2026-10-16', tipo: 'LAC_M' }])
    expect(resumen[1].proximosCronogramas).toEqual([])
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

describe('contarAccesos', () => {
  const base = { escuelaIds: new Set(['a', 'b', 'c']), todas: false, miId: 'f1', reclamosAbiertos: [{ school_id: 'a', fed_id: 'x' }, { school_id: 'a', fed_id: 'x' }, { school_id: 'b', fed_id: 'x' }, { school_id: 'z', fed_id: 'x' }, { school_id: 'y', fed_id: 'f1' }], cronogramasProximos: [{ school_id: 'a' }, { school_id: 'c' }, { school_id: 'z' }, { school_id: null }] }
  it('cuenta lo de las escuelas a cargo y los reclamos que registró el FED', () => {
    expect(contarAccesos(base)).toEqual({ escuelas: 3, conReclamo: 2, reclamosAbiertos: 4, cronogramasProximos: 2 })
  })
  it('el CED cuenta todo el equipo', () => {
    expect(contarAccesos({ ...base, todas: true, escuelaIds: new Set(['a', 'b', 'c', 'y', 'z']) })).toEqual({ escuelas: 5, conReclamo: 4, reclamosAbiertos: 5, cronogramasProximos: 4 })
  })
  it('sin escuelas a cargo, sólo los reclamos propios', () => {
    expect(contarAccesos({ ...base, escuelaIds: new Set() })).toEqual({ escuelas: 0, conReclamo: 0, reclamosAbiertos: 1, cronogramasProximos: 0 })
  })
})

describe('contactos y lista', () => {
  it('toma el contacto principal y cuenta los demás', () => {
    expect(nombreContacto(resumen[0].contacto)).toBe('Luis Pérez'); expect(resumen[0].contactosExtra).toBe(1)
    expect(nombreContacto(resumen[3].contacto)).toBe('Marisol'); expect(resumen[3].contactosExtra).toBe(0)
  })
  it('un contacto vacío no cuenta', () => {
    expect(resumen[1].contacto).toBeNull(); expect(resumen[1].contactosExtra).toBe(0)
    expect(elegirContacto([])).toEqual({ contacto: null, extra: 0 })
  })
  it('se busca también por dirección y por contacto', () => {
    const f = (busqueda: string) => filtrarEscuelas(resumen, { ...FILTROS_ESCUELAS_VACIOS, busqueda }).map(e => e.id)
    expect(f('calle 5')).toEqual(['d']); expect(f('perez')).toEqual(['a']); expect(f('marisol')).toEqual(['d'])
  })
  it('ordena por columna, con los vacíos al final', () => {
    expect(ordenarEscuelas(resumen, 'cue', false).map(e => e.id)).toEqual(['d', 'c', 'b', 'a'])
    expect(ordenarEscuelas(resumen, 'distrito').map(e => e.id)).toEqual(['b', 'd', 'a', 'c'])
    expect(ordenarEscuelas(resumen, 'direccion').map(e => e.id)).toEqual(['d', 'a', 'c', 'b'])
    expect(ordenarEscuelas(resumen, 'nombre').map(e => e.id)).toEqual(['a', 'c', 'b', 'd'])
  })
})
