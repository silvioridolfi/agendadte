import { describe, expect, it } from 'vitest'
import { agruparMarcas, aIso, dentroDeRango, esFinDeSemana, esIso, marcasFeriados, fueraDeRango, partesFechaHora, semanasDelMes, sumarDias, sumarMeses, textoFecha, textoFechaHora, tituloMes } from '@/lib/calendario'

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
  it('marca todos los feriados y recesos como feriado, y los distritales como aniversario con su distrito', () => {
    const m = marcasFeriados([f('2026-10-12', 'Día del Respeto a la Diversidad Cultural', 'nacional'), f('2026-11-19', 'Día de la ciudad', 'distrital', 'LA PLATA'), f('2026-07-20', 'Receso escolar', 'receso')])
    expect(m['2026-10-12']).toEqual({ texto: 'Día del Respeto a la Diversidad Cultural', tipo: 'feriado' })
    expect(m['2026-11-19']).toEqual({ texto: 'Día de la ciudad (distrito La Plata)', tipo: 'aniversario' })
    expect(m['2026-07-20']).toEqual({ texto: 'Receso escolar', tipo: 'feriado' })
    expect(m['2026-10-13']).toBeUndefined()
  })
  it('une los que caen el mismo día: si hay uno para todos, se ve como feriado; avisa los que faltan confirmar', () => {
    const m = marcasFeriados([f('2026-11-20', 'Aniversario', 'distrital', 'ENSENADA'), f('2026-11-20', 'Feriado nacional', 'nacional', null, false)])
    expect(m['2026-11-20']).toEqual({ texto: 'Aniversario (distrito Ensenada) · Feriado nacional · a confirmar', tipo: 'feriado' })
  })
  it('un receso de varias semanas es una sola línea de la lista', () => {
    const dias = ['2027-01-04', '2027-01-05', '2027-01-06', '2027-01-07', '2027-01-08', '2027-01-11', '2027-01-12', '2027-01-15']
    const m = marcasFeriados([f('2027-01-01', 'Año Nuevo', 'nacional'), ...dias.map(d => f(d, 'Vacaciones de verano', 'receso'))])
    const r = agruparMarcas(Object.entries(m))
    expect(r).toEqual([
      { desde: '2027-01-01', hasta: '2027-01-01', texto: 'Año Nuevo', tipo: 'feriado' },
      { desde: '2027-01-04', hasta: '2027-01-12', texto: 'Vacaciones de verano', tipo: 'feriado' },
      { desde: '2027-01-15', hasta: '2027-01-15', texto: 'Vacaciones de verano', tipo: 'feriado' },
    ])
  })
  it('no junta días con nombres distintos ni tipos distintos', () => {
    const r = agruparMarcas([['2026-11-19', { texto: 'A', tipo: 'feriado' }], ['2026-11-20', { texto: 'B', tipo: 'feriado' }], ['2026-11-23', { texto: 'B', tipo: 'aniversario' }]])
    expect(r).toHaveLength(3)
  })
  it('sábado y domingo son las dos últimas columnas', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(esFinDeSemana)).toEqual([false, false, false, false, false, true, true])
  })
})
