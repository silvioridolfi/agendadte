import { describe, expect, it } from 'vitest'
import { enTerritorio } from '@/lib/territorio'
import type { Accion } from '@/lib/agenda'

const it_ = (accion: Accion, o: { school_id?: string | null, lugar?: string | null, cue?: number | null, modalidad?: string | null } = {}) => ({
  accion, school_id: o.school_id === undefined ? 's1' : o.school_id, lugar: o.lugar ?? null, school: (o.school_id === null ? null : { cue: o.cue ?? 60897700 }) as never, modalidad: o.modalidad ?? null,
})

describe('En territorio', () => {
  it('las acciones en escuelas o sedes que no son institucionales cuentan', () => {
    expect(enTerritorio(it_('VISITA TÉCNICA'))).toBe(true)
    expect(enTerritorio(it_('CLUB DE TECNOLOGÍA'))).toBe(true)
    expect(enTerritorio(it_('VISITA TÉCNICA', { school_id: null, lugar: null }))).toBe(false)
  })
  it('la oficina R1 es siempre territorio, aunque se cargue con la DTE como sede o sin escuela', () => {
    expect(enTerritorio(it_('OFICINA R1'))).toBe(true) // EES 31
    expect(enTerritorio(it_('OFICINA R1', { cue: 60000000 }))).toBe(true)
    expect(enTerritorio(it_('OFICINA R1', { school_id: null, lugar: null }))).toBe(true)
    expect(enTerritorio(it_('OFICINA R1', { modalidad: 'Virtual' }))).toBe(false)
  })
  it('la asistencia remota nunca es territorio, ni con una escuela o la DTE como sede', () => {
    expect(enTerritorio(it_('ASISTENCIA REMOTA', { cue: 60000000 }))).toBe(false)
    expect(enTerritorio(it_('ASISTENCIA REMOTA'))).toBe(false)
    expect(enTerritorio(it_('ASISTENCIA REMOTA', { school_id: null, lugar: 'Casa' }))).toBe(false)
  })
  it('una visita con varias etiquetas cuenta si alguna cuenta', () => {
    const visita = (...a: Accion[]) => ({ ...it_(a[0], { cue: 60000000 }), visita: a.map(x => it_(x, { cue: 60000000 })) })
    expect(enTerritorio(visita('ASISTENCIA REMOTA', 'OFICINA R1'))).toBe(true)
    expect(enTerritorio(visita('ASISTENCIA REMOTA'))).toBe(false)
    expect(enTerritorio({ ...it_('ASISTENCIA REMOTA'), visita: [it_('ASISTENCIA REMOTA'), it_('VISITA TÉCNICA')] })).toBe(true)
  })
  it('la reunión presencial en una escuela cuenta; virtual, en la DTE o con Jefatura, no', () => {
    expect(enTerritorio(it_('REUNIÓN', { modalidad: 'Presencial' }))).toBe(true)
    expect(enTerritorio(it_('REUNIÓN', { modalidad: 'Híbrido' }))).toBe(true)
    expect(enTerritorio(it_('REUNIÓN', { modalidad: null }))).toBe(true) // cargadas antes de existir el campo
    expect(enTerritorio(it_('REUNIÓN', { modalidad: 'Virtual' }))).toBe(false)
    expect(enTerritorio(it_('REUNIÓN', { cue: 60000000, modalidad: 'Presencial' }))).toBe(false)
    expect(enTerritorio(it_('REUNIÓN', { school_id: null, lugar: 'JEFATURA DISTRITAL (0134TH0261)', modalidad: 'Presencial' }))).toBe(false)
    expect(enTerritorio(it_('REUNIÓN CON JEFATURA', { modalidad: 'Presencial' }))).toBe(false)
  })
  it('planificación, paro y el resto de lo institucional siguen fuera', () => {
    for (const a of ['PLANIFICACIÓN', 'PARO', 'ADMINISTRATIVO'] as Accion[]) expect(enTerritorio(it_(a))).toBe(false)
  })
})
