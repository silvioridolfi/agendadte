import { describe, expect, it } from 'vitest'
import { UMBRAL_DIAS_HABILES, avisosPendientes, detalleAviso, diasSinActividad, fechaAR, hayAlerta, textoDias } from '@/lib/actividad'

const sinFeriados = new Set<string>()

describe('días sin actividad', () => {
  it('hoy o una fecha futura: cero', () => {
    expect(diasSinActividad('2026-09-30', '2026-09-30', sinFeriados)).toBe(0)
    expect(diasSinActividad('2026-10-02', '2026-09-30', sinFeriados)).toBe(0)
  })
  it('sin actividad registrada no se puede contar', () => {
    expect(diasSinActividad(null, '2026-09-30', sinFeriados)).toBeNull()
  })
  it('cuenta sólo días hábiles: de lunes a lunes son cinco', () => {
    expect(diasSinActividad('2026-09-21', '2026-09-28', sinFeriados)).toBe(5) // martes a viernes y el lunes
  })
  it('el fin de semana no cuenta', () => {
    expect(diasSinActividad('2026-09-25', '2026-09-27', sinFeriados)).toBe(0) // viernes a domingo
    expect(diasSinActividad('2026-09-25', '2026-09-28', sinFeriados)).toBe(1) // hasta el lunes
  })
  it('los feriados y recesos no cuentan', () => {
    expect(diasSinActividad('2026-09-21', '2026-09-28', new Set(['2026-09-23', '2026-09-24']))).toBe(3)
  })
  it('los días de licencia o paro del propio FED no cuentan', () => {
    const licencia = new Set(['2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25'])
    expect(diasSinActividad('2026-09-21', '2026-09-28', sinFeriados, licencia)).toBe(1)
  })
  it('enero no cuenta', () => {
    expect(diasSinActividad('2026-12-30', '2027-02-02', sinFeriados)).toBe(3) // 31/12, 1/2 y 2/2
  })
  it('no modifica los feriados que recibe', () => {
    const f = new Set(['2026-09-23'])
    diasSinActividad('2026-09-21', '2026-09-28', f, new Set(['2026-09-22']))
    expect([...f]).toEqual(['2026-09-23'])
  })
})

describe('aviso', () => {
  it('se activa a partir de cinco días hábiles', () => {
    expect(UMBRAL_DIAS_HABILES).toBe(5)
    expect(hayAlerta(4)).toBe(false)
    expect(hayAlerta(5)).toBe(true)
    expect(hayAlerta(12)).toBe(true)
    expect(hayAlerta(0)).toBe(false)
    expect(hayAlerta(null)).toBe(false)
  })
  it('los textos son neutros', () => {
    expect(textoDias(0)).toBe('hoy')
    expect(textoDias(1)).toBe('hace 1 día hábil')
    expect(textoDias(5)).toBe('hace 5 días hábiles')
    expect(detalleAviso('2026-09-22', 6)).toBe('Última actividad registrada el 22/09 · hace 6 días hábiles')
    expect(detalleAviso('2026-09-22', 6).toLowerCase()).not.toMatch(/incumpl|falta|ausente|no ingres|no entr/)
  })
  it('la fecha se toma en Argentina, no en UTC', () => {
    expect(fechaAR('2026-09-30T02:30:00Z')).toBe('2026-09-29') // 23:30 del día anterior
    expect(fechaAR('2026-09-30T15:00:00Z')).toBe('2026-09-30')
  })
})

describe('a quién se avisa', () => {
  const inactivo = { fed_id: 'fed1', ultima: '2026-09-22', ultima_ts: '2026-09-22T15:00:00Z', dias: 6 }
  it('a la coordinación y a la administración, un aviso a cada una', () => {
    const r = avisosPendientes([inactivo], ['ced', 'admin'], [])
    expect(r.map(x => x.fed_id)).toEqual(['ced', 'admin'])
    expect(r.every(x => x.autor_id === 'fed1' && x.tipo === 'inactividad')).toBe(true)
    expect(r[0].detalle).toBe('Última actividad registrada el 22/09 · hace 6 días hábiles')
  })
  it('nunca al propio FED', () => {
    expect(avisosPendientes([inactivo], ['fed1', 'ced'], []).map(x => x.fed_id)).toEqual(['ced'])
  })
  it('si un FED es también administrador, no se avisa a sí mismo pero sí a los demás', () => {
    expect(avisosPendientes([inactivo], ['ced', 'fed1'], []).map(x => x.fed_id)).toEqual(['ced'])
  })
  it('no se repite el aviso mientras sigue el mismo período sin actividad', () => {
    const previa = { fed_id: 'ced', autor_id: 'fed1', created_at: '2026-09-29T12:00:00Z' } // posterior a la última actividad
    expect(avisosPendientes([inactivo], ['ced', 'admin'], [previa]).map(x => x.fed_id)).toEqual(['admin'])
  })
  it('si el FED volvió a cargar algo después del aviso anterior, un nuevo silencio genera otro aviso', () => {
    const vieja = { fed_id: 'ced', autor_id: 'fed1', created_at: '2026-09-10T12:00:00Z' } // anterior a la última actividad
    expect(avisosPendientes([inactivo], ['ced'], [vieja]).map(x => x.fed_id)).toEqual(['ced'])
  })
  it('un aviso de otro FED no cuenta', () => {
    const deOtro = { fed_id: 'ced', autor_id: 'fed2', created_at: '2026-09-29T12:00:00Z' }
    expect(avisosPendientes([inactivo], ['ced'], [deOtro])).toHaveLength(1)
  })
  it('sin nadie inactivo no hay avisos', () => {
    expect(avisosPendientes([], ['ced', 'admin'], [])).toEqual([])
  })
})
