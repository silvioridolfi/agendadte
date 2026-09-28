import { afterEach, describe, expect, it, vi } from 'vitest'
import { fechaHoyAR, horaAR, hoyAR } from '../lib/hora'

describe('hora argentina', () => {
  afterEach(() => vi.useRealTimers())
  it('a las 22:30 de Argentina sigue siendo el mismo día (en UTC ya es el siguiente)', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-29T01:30:00Z'))
    expect(hoyAR()).toBe('2026-09-28')
    expect(horaAR()).toBe('22:30')
    expect(fechaHoyAR().getDate()).toBe(28)
  })
  it('pasada la medianoche de Argentina cambia el día', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-29T03:05:00Z'))
    expect(hoyAR()).toBe('2026-09-29')
    expect(horaAR()).toBe('00:05')
  })
})
