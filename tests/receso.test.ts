import { describe, expect, it } from 'vitest'
import { diasHabilesEntre, serieFechas } from '@/lib/agenda'
import { esEnero, inicioAnio, inicioCiclo, mensajeEnero, NOMBRE_RECESO_VERANO, recesoEnero } from '@/lib/receso'

describe('enero es receso de verano', () => {
  it('sólo enero cuenta, en cualquier año', () => {
    expect(esEnero('2027-01-04')).toBe(true)
    expect(esEnero('2026-01-31')).toBe(true)
    for (const f of ['2026-02-01', '2026-12-31', '2026-10-01', '2026-11-01']) expect(esEnero(f)).toBe(false)
  })
  it('el mensaje dice la fecha y que los cargos van de febrero a diciembre', () => {
    expect(mensajeEnero('04/01/2027')).toContain('04/01/2027')
    expect(mensajeEnero('04/01/2027')).toContain('febrero a diciembre')
  })
  it('recesoEnero arma un receso por cada día hábil de enero (sin fines de semana)', () => {
    const r = recesoEnero('2027-01-01', '2027-01-31')
    expect(r).toHaveLength(21) // enero de 2027: 21 días de lunes a viernes
    expect(r.every(f => f.tipo === 'receso' && f.nombre === NOMBRE_RECESO_VERANO && f.distrito === null)).toBe(true)
    expect(r.some(f => [0, 6].includes(new Date(`${f.fecha}T12:00:00Z`).getUTCDay()))).toBe(false)
  })
  it('recesoEnero respeta el rango pedido y no toca otros meses', () => {
    expect(recesoEnero('2026-12-30', '2027-02-02').map(f => f.fecha).filter(f => !f.startsWith('2027-01'))).toEqual([])
    expect(recesoEnero('2027-01-11', '2027-01-15')).toHaveLength(5)
    expect(recesoEnero('2027-02-01', '2027-12-31')).toEqual([])
  })
  it('un rango de dos años trae los dos eneros', () => {
    const fechas = recesoEnero('2026-12-01', '2028-01-31').map(f => f.fecha)
    expect(fechas.some(f => f.startsWith('2027-01'))).toBe(true)
    expect(fechas.some(f => f.startsWith('2028-01'))).toBe(true)
  })
})

describe('períodos', () => {
  it('el año empieza el 1 de febrero', () => {
    const d = inicioAnio(2026)
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 1, 1])
  })
  it('el ciclo de clubes y prácticas empieza el 1 de marzo', () => {
    expect(inicioCiclo(2026)).toBe('2026-03-01')
  })
})

describe('series y días hábiles', () => {
  it('una serie que cruza enero lo saltea', () => {
    expect(serieFechas('2026-12-28', [1], '2027-02-08')).toEqual(['2027-02-01', '2027-02-08']) // lunes
  })
  it('los días hábiles entre dos fechas no cuentan enero', () => {
    expect(diasHabilesEntre('2026-12-30', '2027-02-02')).toBe(3) // 31/12, 1/2 y 2/2
  })
})
