import { describe, expect, it } from 'vitest'
import { contarUnidades, unidadDe, cambiaLaSerie, clubesDelDia, destinatarioEstudiantes, inscriptosDelClub, opcionesDestinatarios, partirDestinatarios, PROPUESTAS_DE_CLUB, unirDestinatarios, estadoAlCompletar, horariosSePisan, minEncuentros, proximoEncuentro, textoMinimo } from '@/lib/encuentro'

describe('mínimo de encuentros (sólo informativo)', () => {
  it('los clubes tienen mínimo 8; las prácticas y el resto, ninguno', () => {
    expect(minEncuentros('CLUB DE TECNOLOGÍA')).toBe(8)
    expect(minEncuentros('PRÁCTICAS PROFESIONALIZANTES')).toBeNull()
    expect(minEncuentros('VISITA TÉCNICA')).toBeNull()
    expect(minEncuentros(null)).toBeNull()
  })
  it('el texto dice cuánto falta o que está cumplido, y no aparece en prácticas', () => {
    expect(textoMinimo('CLUB DE TECNOLOGÍA', 3)).toBe('mínimo 8 · faltan 5')
    expect(textoMinimo('CLUB DE TECNOLOGÍA', 8)).toBe('mínimo 8 · cumplido')
    expect(textoMinimo('CLUB DE TECNOLOGÍA', 11)).toBe('mínimo 8 · cumplido') // después del mínimo no importa cuántos más
    expect(textoMinimo('PRÁCTICAS PROFESIONALIZANTES', 3)).toBe('')
  })
})

describe('número del próximo encuentro', () => {
  type E = { encuentro_n: number | null, fecha: string, agenda_item_id?: string, item?: { estado: string } | null }
  const r = (n: number | null, f: string): E => ({ encuentro_n: n, fecha: f })
  const p = (n: number | null, f: string, id: string): E => ({ encuentro_n: n, fecha: f, agenda_item_id: id, item: { estado: 'planificada' } })
  const hechos = [...['2026-08-05', '2026-08-07', '2026-08-14', '2026-09-02', '2026-09-04', '2026-09-09', '2026-09-16', '2026-09-23'].map((f, i) => r(i + 1, f))]
  it('sin encuentros, el 1', () => expect(proximoEncuentro([])).toBe(1))
  it('sigue al mayor número realizado', () => expect(proximoEncuentro([r(1, '2026-08-05'), r(2, '2026-08-07'), r(10, '2026-09-28')])).toBe(11))
  it('sin números cargados, cuenta las fechas distintas', () => expect(proximoEncuentro([r(null, '2026-08-05'), r(null, '2026-08-05'), r(null, '2026-08-07')])).toBe(3))
  it('la fila duplicada del mismo día (planilla + app) cuenta una sola vez', () => {
    expect(proximoEncuentro([...hechos, r(8, '2026-09-23')], '2026-09-30')).toBe(9)
  })
  it('los planificados no contagian: cada grupo toma el 9 el 30/9 aunque otros ya tengan planificado', () => {
    const otros = [p(10, '2026-09-30', 'a'), p(11, '2026-10-02', 'b')]
    expect(proximoEncuentro([...hechos, ...otros], '2026-09-30', 'c')).toBe(9)
  })
  it('el 2/10 es el 10 si el 30/9 sigue planificado', () => {
    expect(proximoEncuentro([...hechos, p(9, '2026-09-30', 'a')], '2026-10-02', 'b')).toBe(10)
    expect(proximoEncuentro(hechos, '2026-10-02', 'b', ['2026-09-30'])).toBe(10)
  })
  it('al editar, no se cuenta a sí mismo', () => {
    expect(proximoEncuentro([...hechos, p(9, '2026-09-30', 'a')], '2026-09-30', 'a')).toBe(9)
  })
  it('los cancelados no cuentan', () => {
    expect(proximoEncuentro([...hechos, { ...p(9, '2026-09-30', 'a'), item: { estado: 'cancelada' } }], '2026-10-02', 'b')).toBe(9)
  })
})

describe('pasa a realizada al completar el encuentro', () => {
  const base = { accion: 'CLUB DE TECNOLOGÍA', estado: 'planificada' as const, fecha: '2026-09-30', hoy: '2026-09-30', inscriptos: '', asistentes: '', descripcion: '', esCierre: false }
  it('con datos cargados, una acción de hoy planificada pasa a realizada', () => {
    expect(estadoAlCompletar({ ...base, asistentes: '18' })).toBe('realizada')
    expect(estadoAlCompletar({ ...base, inscriptos: '20' })).toBe('planificada') // precargado: no alcanza
    expect(estadoAlCompletar({ ...base, descripcion: 'Robótica con kits' })).toBe('realizada')
    expect(estadoAlCompletar({ ...base, esCierre: true })).toBe('realizada')
  })
  it('también las de días anteriores y las reprogramadas', () => {
    expect(estadoAlCompletar({ ...base, fecha: '2026-09-28', asistentes: '15' })).toBe('realizada')
    expect(estadoAlCompletar({ ...base, estado: 'reprogramada', asistentes: '15' })).toBe('realizada')
  })
  it('sin datos no cambia (vacío o sólo espacios); un cero sí es un dato', () => {
    expect(estadoAlCompletar(base)).toBe('planificada')
    expect(estadoAlCompletar({ ...base, descripcion: '   ' })).toBe('planificada')
    expect(estadoAlCompletar({ ...base, asistentes: '0' })).toBe('realizada')
  })
  it('las futuras, las canceladas y las que ya están realizadas no se tocan', () => {
    expect(estadoAlCompletar({ ...base, fecha: '2026-10-02', asistentes: '15' })).toBe('planificada')
    expect(estadoAlCompletar({ ...base, estado: 'cancelada', asistentes: '15' })).toBe('cancelada')
    expect(estadoAlCompletar({ ...base, estado: 'realizada' })).toBe('realizada')
  })
  it('sólo clubes y prácticas', () => {
    expect(estadoAlCompletar({ ...base, accion: 'PRÁCTICAS PROFESIONALIZANTES', asistentes: '10' })).toBe('realizada')
    expect(estadoAlCompletar({ ...base, accion: 'VISITA TÉCNICA', asistentes: '10' })).toBe('planificada')
    expect(estadoAlCompletar({ ...base, accion: null, asistentes: '10' })).toBe('planificada')
  })
})

describe('choque de horarios', () => {
  it('uno a continuación del otro no se pisa', () => {
    expect(horariosSePisan({ ini: '12:00', fin: '13:00' }, { ini: '13:00', fin: '14:00' })).toBe(false)
    expect(horariosSePisan({ ini: '13:00', fin: '14:00' }, { ini: '12:00', fin: '13:00' })).toBe(false)
  })
  it('si se superponen, sí', () => {
    expect(horariosSePisan({ ini: '12:00', fin: '13:30' }, { ini: '13:00', fin: '14:00' })).toBe(true)
    expect(horariosSePisan({ ini: '12:30', fin: '13:00' }, { ini: '12:00', fin: '14:00' })).toBe(true)
  })
  it('el mismo inicio se pisa', () => expect(horariosSePisan({ ini: '12:00', fin: '13:00' }, { ini: '12:00', fin: '15:00' })).toBe(true))
  it('sin horario no se puede decir', () => {
    expect(horariosSePisan({ ini: '', fin: '' }, { ini: '12:00', fin: '13:00' })).toBe(false)
    expect(horariosSePisan({ ini: '12:00', fin: '13:00' }, { ini: '', fin: '' })).toBe(false)
  })
})

describe('ajustes de clubes', () => {
  it('la propuesta por defecto es Club de Tecnología y la lista es corta', () => {
    expect(PROPUESTAS_DE_CLUB[0]).toBe('Club de Tecnología')
    expect(PROPUESTAS_DE_CLUB.length).toBeLessThanOrEqual(14)
  })
  it('destinatarios: el grado del club encabeza las opciones', () => {
    expect(destinatarioEstudiantes('5°')).toBe('Estudiantes de 5°')
    expect(destinatarioEstudiantes(null)).toBe('Estudiantes')
    expect(opcionesDestinatarios('6° B')).toEqual(['Estudiantes de 6° B', 'Docentes', 'Familias', 'Equipo de Conducción', 'JR', 'JD', 'IE'])
    expect(partirDestinatarios('Estudiantes de 5°, Docentes ,')).toEqual(['Estudiantes de 5°', 'Docentes'])
    expect(unirDestinatarios(['Docentes', 'JR'])).toBe('Docentes, JR')
  })
  it('inscriptos: los del primer encuentro que los tenga', () => {
    expect(inscriptosDelClub([])).toBeNull()
    expect(inscriptosDelClub([{ fecha: '2026-09-02', inscriptos: 28 }, { fecha: '2026-08-05', inscriptos: 30 }, { fecha: '2026-09-09', inscriptos: null }])).toBe(30)
    expect(inscriptosDelClub([{ fecha: '2026-08-05', inscriptos: null }, { fecha: '2026-08-07', inscriptos: 30 }])).toBe(30)
  })
  const antes = { fecha: '2026-09-30', hora_inicio: '13:00:00', hora_fin: '14:00:00', school_id: 's1', lugar: null, accion: 'CLUB DE TECNOLOGÍA' }
  const ahora = { fecha: '2026-09-30', hora_inicio: '13:00', hora_fin: '14:00', school_id: 's1', lugar: '', accion: 'CLUB DE TECNOLOGÍA' }
  it('sólo pregunta por la serie si cambia fecha, horario, lugar o tipo', () => {
    expect(cambiaLaSerie(antes, ahora)).toBe(false)
    expect(cambiaLaSerie(antes, { ...ahora, fecha: '2026-10-01' })).toBe(true)
    expect(cambiaLaSerie(antes, { ...ahora, hora_inicio: '14:00' })).toBe(true)
    expect(cambiaLaSerie(antes, { ...ahora, school_id: 's2' })).toBe(true)
  })
  it('clubes del día: propios, del mismo tipo, sin repetir ni canceladas', () => {
    const i = (club_id: string | null, estado = 'planificada', fed_id = 'yo', accion = 'CLUB DE TECNOLOGÍA') => ({ club_id, estado, fed_id, accion })
    expect(clubesDelDia([i('a'), i('a'), i('b'), i('c', 'cancelada'), i(null), i('d', 'planificada', 'otro'), i('e', 'planificada', 'yo', 'VISITA TÉCNICA')], 'CLUB DE TECNOLOGÍA', 'yo')).toEqual(['a', 'b'])
  })
})

describe('prácticas por curso (cohorte)', () => {
  const g = (id: string, cohorte: string | null, school_id: string | null = 's31') => ({ id, school_id, lugar: null, cohorte })
  it('dos grupos del mismo curso son una unidad; sin cohorte, cada grupo es una', () => {
    expect(unidadDe(g('a', '7° Informática'))).toBe(unidadDe(g('b', '7° informática ')))
    expect(unidadDe(g('a', null))).toBe('a')
    expect(unidadDe(g('a', '7° Informática', 's75'))).not.toBe(unidadDe(g('b', '7° Informática')))
  })
  it('cuenta unidades por estado: el curso va en el estado más activo de sus grupos', () => {
    const lista = [{ c: g('1', '7° Informática'), estado: 'activo' }, { c: g('2', '7° Informática'), estado: 'finalizado' }, { c: g('3', null), estado: 'finalizado' }]
    expect(contarUnidades(lista)).toEqual({ total: 2, porEstado: { activo: 1, finalizado: 1 } })
    expect(contarUnidades([])).toEqual({ total: 0, porEstado: {} })
  })
})
