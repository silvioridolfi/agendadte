import { describe, expect, it } from 'vitest'
import { cruceDe, proximosDe, resumenProximos, type CronoCorto } from '@/lib/cruce'

const c = (id: string, ini: string, fin: string, estado: CronoCorto['estado'] = null): CronoCorto => ({ id, tipo: 'LAC_M', fecha_inicio: ini, fecha_fin: fin, proveedor: 'X', estado })
const HOY = '2026-10-07'
const abierto = { estado: 'enviado', enviado_at: '2026-09-15T12:00:00-03:00' }

describe('cruceDe', () => {
  it('trae los cronogramas que no terminaron, del que empieza primero al último', () => {
    const r = cruceDe(abierto, [c('b', '2026-10-20', '2026-10-21'), c('a', '2026-10-12', '2026-10-19'), c('x', '2026-09-01', '2026-09-02')], HOY)
    expect(r.proximos.map(x => x.id)).toEqual(['a', 'b'])
  })
  it('el cronograma en curso cuenta como próximo', () => {
    expect(cruceDe(abierto, [c('a', '2026-10-05', '2026-10-19')], HOY).proximos.map(x => x.id)).toEqual(['a'])
  })
  it('el pasado tiene que ser posterior al reclamo: el más reciente', () => {
    const r = cruceDe(abierto, [c('viejo', '2026-09-01', '2026-09-05'), c('a', '2026-09-20', '2026-09-22'), c('b', '2026-09-28', '2026-09-30')], HOY)
    expect(r.pasado?.id).toBe('b')
    expect(r.proximos).toEqual([])
  })
  it('lo que no se hizo o se reprogramó no sirve de pista', () => {
    const r = cruceDe(abierto, [c('a', '2026-09-20', '2026-09-22', 'no_realizado'), c('b', '2026-10-12', '2026-10-19', 'reprogramado'), c('c', '2026-09-25', '2026-09-26', 'realizado')], HOY)
    expect(r.pasado?.id).toBe('c'); expect(r.proximos).toEqual([])
  })
  it('un reclamo resuelto o anulado no cruza', () => {
    for (const estado of ['resuelto', 'anulado']) expect(cruceDe({ ...abierto, estado }, [c('a', '2026-10-12', '2026-10-19')], HOY)).toEqual({ proximos: [], pasado: null })
  })
})

describe('proximosDe y resumenProximos', () => {
  const x = (id: string, ini: string, fin: string, estado: CronoCorto['estado'] = null): CronoCorto => ({ id, tipo: 'LAC_M', fecha_inicio: ini, fecha_fin: fin, proveedor: null, estado })
  it('deja los que no terminaron y no se reprogramaron, el que empieza primero primero', () => {
    const l = [x('c', '2026-10-20', '2026-10-21'), x('a', '2026-10-12', '2026-10-19'), x('pas', '2026-09-01', '2026-09-02'), x('rep', '2026-10-10', '2026-10-11', 'reprogramado'), x('no', '2026-10-10', '2026-10-11', 'no_realizado')]
    expect(proximosDe(l, '2026-10-07').map(r => r.id)).toEqual(['a', 'c'])
  })
  it('la línea resume el primero y cuántos más hay', () => {
    expect(resumenProximos([])).toBeNull()
    expect(resumenProximos([x('a', '2026-10-14', '2026-10-21')])).toBe('Mantenimiento de piso · 14/10 al 21/10')
    expect(resumenProximos([x('a', '2026-10-09', '2026-10-09'), x('b', '2026-10-20', '2026-10-21')])).toBe('Mantenimiento de piso · 09/10 (+1)')
  })
})
