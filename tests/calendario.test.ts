import { describe, expect, it } from 'vitest'
import { aIso, dentroDeRango, esFinDeSemana, esIso, marcasFeriados, fueraDeRango, partesFechaHora, semanasDelMes, sumarDias, sumarMeses, textoFecha, textoFechaHora, tituloMes } from '@/lib/calendario'

describe('calendario del selector de fechas', () => {
  it('valida fechas AAAA-MM-DD reales', () => {
    expect(esIso('2026-10-09')).toBe(true)
    expect(esIso('2026-02-30')).toBe(false)
    expect(esIso('09/10/2026')).toBe(false)
    expect(esIso('')).toBe(false)
  })
  it('suma días y meses sin salirse del mes de destino', () => {
    expect(sumarDias('2026-10-31', 1)).toBe('2026-11-01')
    expect(sumarDias('2026-01-01', -1)).toBe('2025-12-31')
    expect(sumarMeses('2026-01-31', 1)).toBe('2026-02-28')
    expect(sumarMeses('2026-01-15', -1)).toBe('2025-12-15')
    expect(sumarMeses('2024-01-31', 1)).toBe('2024-02-29')
    expect(aIso(2026, 12, 1)).toBe('2027-01-01')
  })
  it('el mes se arma de lunes a domingo y siempre con 6 semanas', () => {
    const s = semanasDelMes('2026-10-09')
    expect(s).toHaveLength(6)
    expect(s.every(x => x.length === 7)).toBe(true)
    // octubre de 2026 empieza un jueves: la primera fila arranca el lunes 28/09.
    expect(s[0][0].iso).toBe('2026-09-28'); expect(s[0][0].delMes).toBe(false)
    expect(s[0][3].iso).toBe('2026-10-01'); expect(s[0][3].delMes).toBe(true)
    expect(s.flat().filter(d => d.delMes)).toHaveLength(31)
    // febrero de 2027 empieza un lunes.
    expect(semanasDelMes('2027-02-10')[0][0]).toEqual({ iso: '2027-02-01', delMes: true })
  })
  it('respeta el rango permitido, inclusive', () => {
    expect(fueraDeRango('2026-10-10', undefined, '2026-10-09')).toBe(true)
    expect(fueraDeRango('2026-10-09', undefined, '2026-10-09')).toBe(false)
    expect(fueraDeRango('2026-10-01', '2026-10-05')).toBe(true)
    expect(fueraDeRango('2026-10-05', '2026-10-05', '2026-10-06')).toBe(false)
    expect(dentroDeRango('2026-10-20', '2026-10-01', '2026-10-09')).toBe('2026-10-09')
    expect(dentroDeRango('2026-09-01', '2026-10-01', '2026-10-09')).toBe('2026-10-01')
    expect(dentroDeRango('2026-10-05')).toBe('2026-10-05')
  })
  it('da los textos en español', () => {
    expect(tituloMes('2026-10-09')).toBe('octubre de 2026')
    expect(textoFecha('2026-10-09')).toBe('09/10/2026')
    expect(textoFecha('')).toBe('')
    expect(textoFechaHora('2026-10-09T08:05')).toBe('09/10/2026 08:05')
    expect(partesFechaHora('2026-10-09T08:05')).toEqual({ fecha: '2026-10-09', hora: '08', minuto: '05' })
    expect(partesFechaHora('basura')).toEqual({ fecha: '', hora: '', minuto: '' })
  })
})

describe('marcas de feriados (a nivel global)', () => {
  const f = (fecha: string, nombre: string, tipo: 'nacional' | 'distrital' | 'receso', distrito: string | null = null, confirmado = true) => ({ fecha, nombre, tipo, distrito, confirmado })
  it('marca todos los feriados y recesos, y aclara el distrito de los distritales', () => {
    const m = marcasFeriados([f('2026-10-12', 'Día del Respeto a la Diversidad Cultural', 'nacional'), f('2026-11-19', 'Día de la ciudad', 'distrital', 'LA PLATA'), f('2026-07-20', 'Receso escolar', 'receso')])
    expect(m['2026-10-12']).toBe('Día del Respeto a la Diversidad Cultural')
    expect(m['2026-11-19']).toBe('Día de la ciudad (distrito La Plata)')
    expect(m['2026-07-20']).toBe('Receso escolar')
    expect(m['2026-10-13']).toBeUndefined()
  })
  it('une los que caen el mismo día y avisa los que faltan confirmar', () => {
    const m = marcasFeriados([f('2026-11-20', 'Feriado nacional', 'nacional', null, false), f('2026-11-20', 'Aniversario', 'distrital', 'ENSENADA')])
    expect(m['2026-11-20']).toBe('Feriado nacional · a confirmar · Aniversario (distrito Ensenada)')
  })
  it('sábado y domingo son las dos últimas columnas', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(esFinDeSemana)).toEqual([false, false, false, false, false, true, true])
  })
})

