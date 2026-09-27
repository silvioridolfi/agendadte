import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase-server', () => ({ supabaseServer: () => ({}) }))
import { carpetaMes, inicioMes, mesesAbiertos, nombrePve, ultimoHabil } from '@/lib/pve'

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
  it('último día hábil del mes', () => {
    expect(ultimoHabil('2026-10-05')).toBe('2026-10-30') // 31/10/2026 es sábado
    expect(ultimoHabil('2026-09-01')).toBe('2026-09-30')
    expect(ultimoHabil('2026-05-12')).toBe('2026-05-29') // 30 y 31 caen fin de semana
  })
})
