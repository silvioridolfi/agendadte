import { beforeEach, describe, expect, it, vi } from 'vitest'

type Op = { m: string, args: unknown[] }
type Llamada = { tabla: string, ops: Op[] }
const estado = vi.hoisted(() => ({ responder: (_l: Llamada): { data?: unknown } => ({}), llamadas: [] as Llamada[] }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase-server', () => ({
  supabaseServer: () => ({
    from: (tabla: string) => {
      const l: Llamada = { tabla, ops: [] }
      estado.llamadas.push(l)
      const cadena: unknown = new Proxy({}, { get: (_, m: string) => m === 'then' ? (ok: (v: unknown) => unknown) => Promise.resolve({ data: estado.responder(l).data ?? null, error: null }).then(ok) : (...args: unknown[]) => { l.ops.push({ m, args }); return cadena } })
      return cadena
    },
  }),
}))

import { armarJornadas, camposDeJornada, cuesDe, destinatariosDeForm, estaPendiente, filtrarJornadas, FILTROS_JORNADAS, huellaDe, lugarDe, textoDeJornada, type EncuentroJ, type ClubJ } from '@/lib/jornadas'
import { contarJornadasPendientes, jornadasImpl, marcarJornadaImpl } from '@/lib/servidor/jornadas'
import type { Usuario } from '@/lib/sesion'

const esc = (cue: number, nombre: string, distrito = 'LA PLATA') => ({ cue, nombre, distrito })
const enc = (o: Partial<EncuentroJ>): EncuentroJ => ({ id: 'e1', agenda_item_id: null, fed_id: 'f1', fecha: '2026-09-10', tipo: 'TALLER/CAPACITACIÓN', lugar: null, propuesta: 'Robótica', modalidad: 'Presencial',
  tipo_jornada: 'Taller', club_id: null, destinatarios: 'Docentes', inscriptos: 20, asistentes: 15, descripcion: '', school: esc(111, 'ESCUELA DE EDUCACIÓN SECUNDARIA 1'), ...o })
const feds = [{ id: 'f1', nombre_completo: 'Ana Pérez' }]
const vacio = { carpetaAccion: new Map(), carpetaDia: new Map() }

describe('destinatariosDeForm', () => {
  it('mapea el texto libre a las casillas', () => {
    expect(destinatariosDeForm('Estudiantes de 6° A')).toEqual(['Estudiantes'])
    expect(destinatariosDeForm('Docentes y directivos')).toEqual(['Equipo de Conducción', 'Docentes'])
    expect(destinatariosDeForm('Inspectora e Jefe Distrital')).toEqual(['JD', 'IE'])
  })
  it('lo que no reconoce va a Otros', () => {
    expect(destinatariosDeForm('Comunidad')).toEqual(['Otros (aclarar en observaciones)'])
    expect(destinatariosDeForm(null)).toEqual(['Otros (aclarar en observaciones)'])
  })
})

describe('lugar y CUE', () => {
  it('virtual, escuela o texto libre', () => {
    expect(lugarDe({ modalidad: 'Virtual', lugar: null, school: null })).toBe('Virtual')
    expect(lugarDe({ modalidad: 'Presencial', lugar: null, school: esc(111, 'ESCUELA DE EDUCACIÓN SECUNDARIA 1') })).toMatch(/- 111$/)
    expect(lugarDe({ modalidad: 'Presencial', lugar: ' Biblioteca ', school: null })).toBe('Biblioteca')
    expect(lugarDe({ modalidad: null, lugar: null, school: null })).toBe('—')
  })
  it('CUE sin repetir', () => {
    expect(cuesDe(esc(1, 'a'), esc(2, 'b'), esc(1, 'a'), null)).toBe('1 - 2')
  })
})

describe('armarJornadas: una fila por encuentro', () => {
  it('deja afuera los encuentros sin participantes', () => {
    expect(armarJornadas({ encuentros: [enc({ asistentes: 0 }), enc({ id: 'e2', asistentes: null })], clubes: [], feds, ...vacio })).toEqual([])
  })
  it('cada encuentro es una fila con 1 encuentro, aunque sea del mismo club', () => {
    const club: ClubJ = { id: 'c1', grupo: 'A', propuesta: 'Club de robótica', fecha_cierre: null, school: esc(222, 'EES 2', 'BERISSO'), escuela_origen: esc(333, 'EP 3') }
    const es = [enc({ id: 'b', club_id: 'c1', tipo: 'CLUB DE TECNOLOGÍA', fecha: '2026-09-17', inscriptos: 12, asistentes: 6 }), enc({ id: 'a', club_id: 'c1', tipo: 'CLUB DE TECNOLOGÍA', inscriptos: 10, asistentes: 8 })]
    const r = armarJornadas({ encuentros: es, clubes: [club], feds, ...vacio })
    expect(r.map(j => [j.encuentroId, j.nro, j.participantes, j.inscriptos, j.fecha])).toEqual([['a', 1, 8, 10, '2026-09-10'], ['b', 2, 6, 12, '2026-09-17']])
    expect(r[0]).toMatchObject({ distrito: 'Berisso', cues: '222 - 333', propuesta: 'Robótica', grupo: 'A' })
    expect(camposDeJornada(r[0]).find(c => c.clave === 'encuentros')?.valor).toBe('1')
    expect(camposDeJornada(r[1]).find(c => c.clave === 'fechaFin')?.valor).toBe('17/09/2026')
  })
  it('FED / CED a cargo: quien creó la acción y quienes acompañan, estén pendientes o no, menos quien no puede', () => {
    const f3 = [...feds, { id: 'f2', nombre_completo: 'Carlos Gómez' }, { id: 'f3', nombre_completo: 'Luz Díaz' }, { id: 'f4', nombre_completo: 'Pedro Ruiz' }]
    const [j] = armarJornadas({ encuentros: [enc({ agenda_item_id: 'i1' })], clubes: [], feds: f3, ...vacio,
      acompanantes: new Map([['i1', [{ fed_id: 'f2', respuesta: 'pendiente' }, { fed_id: 'f3', respuesta: 'acepta' }, { fed_id: 'f4', respuesta: 'rechaza' }, { fed_id: 'f1', respuesta: 'acepta' }]]]) })
    expect(j.aCargo).toEqual(['Ana Pérez', 'Carlos Gómez', 'Luz Díaz'])
    expect(camposDeJornada(j).find(c => c.clave === 'fed')?.valor).toBe('Ana Pérez, Carlos Gómez, Luz Díaz')
  })
  it('fotos: si las sacó quien acompañó, dice de quién son', () => {
    const f2 = [...feds, { id: 'f2', nombre_completo: 'Carlos Franco' }]
    const [j] = armarJornadas({ encuentros: [enc({ agenda_item_id: 'i1' })], clubes: [], feds: f2, carpetaAccion: new Map([['i1', { url: 'u', n: 3, fedId: 'f2' }]]), carpetaDia: new Map() })
    expect(j.foto).toMatchObject({ n: 3, de: 'Carlos Franco' })
    const [propia] = armarJornadas({ encuentros: [enc({ agenda_item_id: 'i1' })], clubes: [], feds: f2, carpetaAccion: new Map([['i1', { url: 'u', n: 3, fedId: 'f1' }]]), carpetaDia: new Map() })
    expect(propia.foto?.de).toBeUndefined()
  })
  it('fotos: la de la acción o, si no, la del día', () => {
    const r = armarJornadas({ encuentros: [enc({ agenda_item_id: 'i1' }), enc({ id: 'e2', fecha: '2026-09-11' }), enc({ id: 'e3', fecha: '2026-09-12' })], clubes: [], feds,
      carpetaAccion: new Map([['i1', { url: 'u-accion', n: 3 }]]), carpetaDia: new Map([['f1|2026-09-11', { url: 'u-dia', n: 5 }]]) })
    expect(r.map(j => j.foto)).toEqual([{ fecha: '2026-09-10', url: 'u-accion', n: 3, deAccion: true }, { fecha: '2026-09-11', url: 'u-dia', n: 5, deAccion: false }, null])
  })
})

describe('marca de cargada', () => {
  const base = armarJornadas({ encuentros: [enc({})], clubes: [], feds, ...vacio })[0]
  const conMarca = (datos: string) => armarJornadas({ encuentros: [enc({})], clubes: [], feds, ...vacio, marcas: new Map([['e1', { por: 'f1', cuando: '2026-10-09T12:00:00Z', datos }]]) })[0]
  it('sin marca es pendiente; con la marca vigente, no', () => {
    expect(estaPendiente(base)).toBe(true)
    const ok = conMarca(huellaDe(base))
    expect(ok.cargada).toMatchObject({ por: 'Ana Pérez', modificada: false }); expect(estaPendiente(ok)).toBe(false)
  })
  it('si cambió algo de lo que se carga después de marcarla, figura modificada y vuelve a pendientes', () => {
    const m = conMarca(huellaDe({ ...base, participantes: base.participantes + 1 }))
    expect(m.cargada?.modificada).toBe(true); expect(estaPendiente(m)).toBe(true)
  })
  it('las fotos o el número de encuentro no cuentan como modificación', () => {
    expect(huellaDe({ ...base, nro: 7, foto: { fecha: base.fecha, url: 'x', n: 1, deAccion: true } })).toBe(huellaDe(base))
  })
})

describe('filtros y campos', () => {
  const club: ClubJ = { id: 'c1', grupo: null, propuesta: 'X', fecha_cierre: null, school: esc(222, 'EES 2', 'BERISSO'), escuela_origen: null }
  const huella = huellaDe(armarJornadas({ encuentros: [enc({})], clubes: [], feds, ...vacio })[0])
  const lista = armarJornadas({ encuentros: [enc({}), enc({ id: 'b', club_id: 'c1', tipo: 'CLUB DE TECNOLOGÍA', fecha: '2026-10-01' })], clubes: [club], feds, ...vacio, marcas: new Map([['e1', { por: 'f1', cuando: '2026-10-02T00:00:00Z', datos: huella }]]) })
  it('por defecto solo las pendientes; también cargadas o todas', () => {
    expect(filtrarJornadas(lista, FILTROS_JORNADAS).map(j => j.encuentroId)).toEqual(['b'])
    expect(filtrarJornadas(lista, { ...FILTROS_JORNADAS, estado: 'cargadas' }).map(j => j.encuentroId)).toEqual(['e1'])
    expect(filtrarJornadas(lista, { ...FILTROS_JORNADAS, estado: 'todas' })).toHaveLength(2)
  })
  it('por período, distrito y tipo', () => {
    const f = { ...FILTROS_JORNADAS, estado: 'todas' as const }
    expect(filtrarJornadas(lista, { ...f, desde: '2026-09-20' })).toHaveLength(1)
    expect(filtrarJornadas(lista, { ...f, distrito: 'Berisso' })).toHaveLength(1)
    expect(filtrarJornadas(lista, { ...f, tipo: 'TALLER/CAPACITACIÓN' })).toHaveLength(1)
  })
  it('los campos siguen el orden del formulario y el texto los junta', () => {
    const c = camposDeJornada(lista[0])
    expect(c[0]).toMatchObject({ clave: 'region', valor: '1' })
    expect(c.find(x => x.clave === 'fechaFin')?.valor).toBe('10/09/2026')
    expect(textoDeJornada(lista[0]).split('\n')).toHaveLength(c.length)
  })
})

describe('el servidor: quién ve y quién marca', () => {
  const usuario = (id: string, rol: 'fed' | 'coordinacion', esAdmin = false) => ({ fed: { id, nombre_completo: id, rol }, esAdmin }) as unknown as Usuario
  const UUID_E = '11111111-1111-4111-8111-111111111111'
  const fila = { id: UUID_E, agenda_item_id: null, fed_id: 'f1', fecha: '2026-09-10', tipo: 'TALLER/CAPACITACIÓN', lugar: 'Biblioteca', propuesta: 'Robótica', modalidad: 'Presencial', tipo_jornada: 'Taller', club_id: null, destinatarios: 'Docentes', inscriptos: 20, asistentes: 15, descripcion: '', school: null, item: { estado: 'realizada' } }
  beforeEach(() => { estado.llamadas = []; estado.responder = l => l.tabla === 'agenda_encuentros' ? { data: [fila] } : l.tabla === 'feds' ? { data: [{ id: 'f1', nombre_completo: 'Ana Pérez' }] } : {} })
  const lecturasEncuentros = () => estado.llamadas.filter(l => l.tabla === 'agenda_encuentros')
  it('un FED pide solo los encuentros que creó él', async () => {
    await jornadasImpl(usuario('f1', 'fed'))
    expect(lecturasEncuentros()[0].ops).toContainEqual({ m: 'eq', args: ['fed_id', 'f1'] })
  })
  it('la coordinación y la administración piden todos', async () => {
    await jornadasImpl(usuario('c1', 'coordinacion')); await jornadasImpl(usuario('a1', 'fed', true))
    expect(lecturasEncuentros().every(l => !l.ops.some(o => o.m === 'eq' && o.args[0] === 'fed_id'))).toBe(true)
  })
  it('un FED marca los suyos y guarda lo que había que cargar', async () => {
    estado.responder = l => l.tabla === 'agenda_encuentros' ? { data: l.ops.some(o => o.m === 'maybeSingle') ? { id: UUID_E, fed_id: 'f1' } : [fila] } : l.tabla === 'feds' ? { data: [{ id: 'f1', nombre_completo: 'Ana Pérez' }] } : {}
    await marcarJornadaImpl(usuario('f1', 'fed'), UUID_E, true)
    const up = estado.llamadas.find(l => l.tabla === 'jornadas_cargadas' && l.ops.some(o => o.m === 'upsert'))!
    expect(up.ops.find(o => o.m === 'upsert')!.args[0]).toMatchObject({ encuentro_id: UUID_E, cargado_por: 'f1' })
    expect(String((up.ops.find(o => o.m === 'upsert')!.args[0] as { datos: string }).datos)).toContain('Robótica')
  })
  it('un FED no marca los de otro; la coordinación sí', async () => {
    estado.responder = l => l.tabla === 'agenda_encuentros' ? { data: l.ops.some(o => o.m === 'maybeSingle') ? { id: UUID_E, fed_id: 'f1' } : [fila] } : l.tabla === 'feds' ? { data: [{ id: 'f1', nombre_completo: 'Ana Pérez' }] } : {}
    await expect(marcarJornadaImpl(usuario('f2', 'fed'), UUID_E, true)).rejects.toThrow(/No podés marcar/)
    expect(estado.llamadas.some(l => l.tabla === 'jornadas_cargadas')).toBe(false)
    await expect(marcarJornadaImpl(usuario('c1', 'coordinacion'), UUID_E, true)).resolves.toBeUndefined()
  })
  it('desmarcar borra la marca, y un id inválido se rechaza', async () => {
    estado.responder = l => l.tabla === 'agenda_encuentros' ? { data: { id: UUID_E, fed_id: 'f1' } } : {}
    await marcarJornadaImpl(usuario('f1', 'fed'), UUID_E, false)
    expect(estado.llamadas.some(l => l.tabla === 'jornadas_cargadas' && l.ops.some(o => o.m === 'delete'))).toBe(true)
    await expect(marcarJornadaImpl(usuario('f1', 'fed'), 'x', true)).rejects.toThrow(/inválido/)
  })
  it('el contador de pendientes es solo de las propias (aunque sea coordinación) y no pide fotos', async () => {
    estado.llamadas = []
    expect(await contarJornadasPendientes(usuario('c1', 'coordinacion'), '2026-09-28')).toBe(1)
    expect(lecturasEncuentros()[0].ops).toContainEqual({ m: 'eq', args: ['fed_id', 'c1'] })
    expect(estado.llamadas.some(l => l.tabla.startsWith('fotos'))).toBe(false)
  })
})
