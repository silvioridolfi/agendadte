import { describe, expect, it } from 'vitest'
import { resumenHistorial, separarHistorial, type FilaHistorial } from '@/lib/escuela'

let n = 0
const fila = (p: Partial<FilaHistorial>): FilaHistorial => ({ id: `f${++n}`, fed_id: 'a', fecha: '2026-09-01', hora_inicio: null, accion: 'VISITA TÉCNICA', sub_accion: null, estado: 'realizada', propia: false, ...p })

describe('historial de una escuela', () => {
  const hoy = '2026-10-02'
  const filas = [
    fila({ fecha: '2026-09-10' }), fila({ fecha: '2026-09-20', fed_id: 'b' }), fila({ fecha: '2026-10-09', estado: 'planificada' }),
    fila({ fecha: '2026-10-05', estado: 'planificada' }), fila({ fecha: '2026-09-25', estado: 'planificada' }), fila({ fecha: '2026-09-12', estado: 'reprogramada' }),
  ]
  it('separa lo que viene de lo anterior', () => {
    const { proximas, anteriores } = separarHistorial(filas, hoy)
    expect(proximas.map(f => f.fecha)).toEqual(['2026-10-05', '2026-10-09'])
    expect(anteriores.map(f => f.fecha)).toEqual(['2026-09-25', '2026-09-20', '2026-09-12', '2026-09-10'])
  })
  it('resume realizadas, FED distintos y última fecha', () => {
    expect(resumenHistorial(filas)).toEqual({ realizadas: 2, feds: 2, ultima: '2026-09-20' })
    expect(resumenHistorial([])).toEqual({ realizadas: 0, feds: 0, ultima: null })
  })
})
