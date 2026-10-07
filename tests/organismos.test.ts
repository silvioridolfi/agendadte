import { describe, expect, it } from 'vitest'
import { cambiosDeOrganismo } from '@/lib/organismos'

const actual = { telefono: '2214247260', email: 'jr01@abc.gob.ar', latitud: -34.9199755, longitud: -57.95558995, observaciones: null, domicilio: 'Calle 1' }
describe('cambiosDeOrganismo', () => {
  it('devuelve sólo lo que cambió', () => {
    const c = cambiosDeOrganismo(actual, { telefono: ' 221 424-7261 ', email: 'JR01@abc.gob.ar', latitud: '-34.9199755', longitud: '-57.95558995' })
    expect(c.map(x => [x.clave, x.anterior, x.nuevo])).toEqual([['telefono', '2214247260', '221 424-7261']])
  })
  it('valida teléfono, correo y ubicación', () => {
    expect(() => cambiosDeOrganismo(actual, { telefono: 'abc' })).toThrow(/teléfono/)
    expect(() => cambiosDeOrganismo(actual, { email: 'x@' })).toThrow(/correo/)
    expect(() => cambiosDeOrganismo(actual, { latitud: '34.9' })).toThrow(/fuera de la región/)
    expect(() => cambiosDeOrganismo(actual, { cue: 1 })).toThrow(/no se puede editar/)
  })
})
