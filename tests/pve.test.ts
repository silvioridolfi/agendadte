import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase-server', () => ({ supabaseServer: () => ({}) }))
import { avisoPve, carpetaMes, inicioMes, mesesEntregables, nombrePve, sinEntregar, vencimientoPve } from '@/lib/pve'

describe('PVE', () => {
  it('meses y carpetas', () => {
    expect(inicioMes('2026-10-15')).toBe('2026-10-01')
    expect(inicioMes('2026-01-10', -1)).toBe('2025-12-01')
    expect(mesesEntregables('2026-11-03')).toEqual(['2026-11-01', '2026-10-01', '2026-09-01'])
    expect(mesesEntregables('2026-09-27')).toEqual(['2026-09-01']) // agosto ya se entregó por fuera
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

describe('aviso de la PVE', () => {
  it('el 1.er día hábil avisa que ya se puede subir y cuándo vence', () => {
    expect(avisoPve('2026-10-01')).toEqual({ mes: '2026-09-01', vence: '2026-10-07', tipo: 'aviso', texto: 'Ya podés subir tu PVE de septiembre 2026: vence el 07/10' })
  })
  it('el 4.º día hábil recuerda que vence mañana', () => {
    expect(avisoPve('2026-10-06')).toEqual({ mes: '2026-09-01', vence: '2026-10-07', tipo: 'recordatorio', texto: 'Mañana (07/10) vence tu PVE de septiembre 2026' })
  })
  it('los demás días no avisa, ni los fines de semana', () => {
    for (const d of ['2026-10-02', '2026-10-05', '2026-10-07', '2026-10-03', '2026-10-15']) expect(avisoPve(d)).toBeNull()
  })
  it('respeta feriados y no avisa antes de la primera entrega por la agenda', () => {
    // 1/11/2026 es domingo: el 1.er día hábil de noviembre es el lunes 2, y si ese día es feriado, el martes 3.
    expect(avisoPve('2026-11-02')?.tipo).toBe('aviso')
    expect(avisoPve('2026-11-02', new Set(['2026-11-02']))).toBeNull()
    expect(avisoPve('2026-11-03', new Set(['2026-11-02']))?.tipo).toBe('aviso')
    expect(avisoPve('2026-09-01')).toBeNull() // la PVE de agosto se entregó por fuera
  })
})

describe('FED sin entregar', () => {
  it('quedan los que no tienen una PVE con archivo', () => {
    const todos = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    expect(sinEntregar(todos, [{ fed_id: 'b' }])).toEqual([{ id: 'a' }, { id: 'c' }])
    expect(sinEntregar(todos, [])).toEqual(todos)
    expect(sinEntregar(todos, [{ fed_id: 'a' }, { fed_id: 'b' }, { fed_id: 'c' }])).toEqual([])
  })
})
