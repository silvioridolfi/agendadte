import { describe, expect, it } from 'vitest'
import { estadoAlCrear } from '@/lib/estado'

const hoy = '2026-10-01'
describe('estado al crear una acción', () => {
  it('una planificada de fecha pasada se registra como realizada', () => {
    expect(estadoAlCrear({ accion: 'VISITA TÉCNICA', fecha: '2026-09-15', hoy, estado: 'planificada' })).toBe('realizada')
  })
  it('hoy y el futuro quedan planificados', () => {
    expect(estadoAlCrear({ accion: 'VISITA TÉCNICA', fecha: hoy, hoy, estado: 'planificada' })).toBe('planificada')
    expect(estadoAlCrear({ accion: 'VISITA TÉCNICA', fecha: '2026-10-05', hoy, estado: 'planificada' })).toBe('planificada')
  })
  it('un paro queda realizado sea cual sea la fecha', () => {
    for (const fecha of ['2026-09-15', hoy, '2026-10-20']) expect(estadoAlCrear({ accion: 'PARO', fecha, hoy, estado: 'planificada' })).toBe('realizada')
  })
  it('un estado elegido se respeta, también en un paro', () => {
    expect(estadoAlCrear({ accion: 'PARO', fecha: hoy, hoy, estado: 'cancelada' })).toBe('cancelada')
    expect(estadoAlCrear({ accion: 'VISITA TÉCNICA', fecha: '2026-09-15', hoy, estado: 'cancelada' })).toBe('cancelada')
    expect(estadoAlCrear({ accion: 'LICENCIA', fecha: '2026-10-05', hoy, estado: 'reprogramada' })).toBe('reprogramada')
  })
  it('la licencia futura sigue planificada', () => {
    expect(estadoAlCrear({ accion: 'LICENCIA', fecha: '2026-10-05', hoy, estado: 'planificada' })).toBe('planificada')
  })
})
