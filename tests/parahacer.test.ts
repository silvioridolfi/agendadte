import { describe, expect, it } from 'vitest'
import { calcularParaHacer, faltantesDe, hayParaHacer, INICIO_AGENDA } from '@/lib/parahacer'
import type { AgendaItem } from '@/lib/agenda'

const enc = (o: Record<string, unknown> = {}) => ({ id: 'e', tipo: 'CLUB DE TECNOLOGÍA', fecha: '2026-10-05', asistentes: 10, inscriptos: 12, tipo_jornada: 'Taller', destinatarios: 'Estudiantes', ...o })
const item = (o: Record<string, unknown> = {}) => ({ id: 'a', fed_id: 'f1', fecha: '2026-10-05', hora_inicio: null, estado: 'realizada', accion: 'CLUB DE TECNOLOGÍA', encuentros: [enc()], ...o }) as unknown as AgendaItem
const base = { fedId: 'f1', hoy: '2026-10-09', jornadasPendientes: 0, cronogramas: [] }

describe('faltantesDe', () => {
  it('un encuentro completo no falta nada', () => expect(faltantesDe(enc())).toEqual([]))
  it('detecta lo que pide el formulario', () => {
    expect(faltantesDe(enc({ asistentes: null, inscriptos: null, tipo_jornada: ' ', destinatarios: null }))).toEqual(['participantes', 'inscriptos', 'tipo de jornada', 'destinatarios'])
    expect(faltantesDe(enc({ asistentes: 0 }))).toEqual(['participantes'])
  })
  it('cero inscriptos es un dato; solo vacío cuenta como falta', () => expect(faltantesDe(enc({ inscriptos: 0 }))).toEqual([]))
  it('lo que no es pedagógico no se revisa', () => expect(faltantesDe(enc({ tipo: 'VISITA TÉCNICA', asistentes: null }))).toEqual([]))
})

describe('calcularParaHacer', () => {
  it('sin cerrar: planificadas con fecha pasada (no las de hoy ni las futuras), de más vieja a más nueva', () => {
    const d = calcularParaHacer({ ...base, items: [item({ id: 'b', estado: 'planificada', fecha: '2026-10-07' }), item({ id: 'a', estado: 'planificada', fecha: '2026-10-02' }), item({ id: 'h', estado: 'planificada', fecha: '2026-10-09' }), item({ id: 'f', estado: 'planificada', fecha: '2026-10-12' })] })
    expect(d.sinCerrar.map(i => i.id)).toEqual(['a', 'b'])
  })
  it('lo anterior al inicio de la agenda no se revisa', () => {
    const d = calcularParaHacer({ ...base, items: [item({ id: 'v', estado: 'planificada', fecha: '2026-09-20' }), item({ id: 'w', encuentros: [enc({ fecha: '2026-09-20', asistentes: null })], fecha: '2026-09-20' })] })
    expect(d.sinCerrar).toEqual([]); expect(d.incompletos).toEqual([])
    expect(INICIO_AGENDA).toBe('2026-09-28')
  })
  it('solo las acciones propias', () => {
    expect(calcularParaHacer({ ...base, items: [item({ fed_id: 'otro', estado: 'planificada', fecha: '2026-10-02' })] }).sinCerrar).toEqual([])
  })
  it('incompletos: realizadas con datos que faltan, con lo que falta', () => {
    const d = calcularParaHacer({ ...base, items: [item({ id: 'x', encuentros: [enc({ inscriptos: null }), enc({ id: 'e2', destinatarios: '' })] }), item({ id: 'ok' }), item({ id: 'p', estado: 'planificada', encuentros: [enc({ asistentes: null })] })] })
    expect(d.incompletos).toEqual([{ item: expect.objectContaining({ id: 'x' }), faltan: ['inscriptos', 'destinatarios'] }])
  })
  it('hayParaHacer: sin nada, nada; con cualquier cosa, sí', () => {
    expect(hayParaHacer(calcularParaHacer({ ...base, items: [item()] }))).toBe(false)
    expect(hayParaHacer(calcularParaHacer({ ...base, items: [], jornadasPendientes: 2 }))).toBe(true)
    expect(hayParaHacer(calcularParaHacer({ ...base, items: [], cronogramas: [{ id: 'c', cue: 1, nombre: null, tipo: null, fecha_inicio: '2026-10-10', fecha_fin: '2026-10-12' }] }))).toBe(true)
  })
})
