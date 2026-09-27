import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase-server', () => ({ supabaseServer: () => ({}) }))
import { carpetaMes, inicioMes, mesesAbiertos, nombrePve, vencimientoPve } from '@/lib/pve'

describe('PVE', () => {
  it('meses y carpetas', () => {
    expect(inicioMes('2026-10-15')).toBe('2026-10-01')
    expect(inicioMes('2026-01-10', -1)).toBe('2025-12-01')
    expect(mesesAbiertos('2026-11-03')).toEqual(['2026-10-01', '2026-11-01'])
    expect(carpetaMes('2026-10-01')).toBe('PVE 10-2026')
  })
  it('nombre del archivo según el instructivo', () => {
    expect(nombrePve('2026-10-01', 'Silvio Ridolfi')).toBe('R01 - PVE (OCTUBRE 2026) - SILVIO RIDOLFI.pdf')
  })
  it('vence el 5.º día hábil del mes siguiente', () => {
    expect(vencimientoPve('2026-09-01')).toBe('2026-10-07') // 1, 2, 5, 6 y 7 de octubre
    expect(vencimientoPve('2026-10-01')).toBe('2026-11-06')
    expect(vencimientoPve('2026-10-01', new Set(['2026-11-02']))).toBe('2026-11-09') // con un feriado en el medio
  })
})
