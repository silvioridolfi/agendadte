import { describe, expect, it } from 'vitest'
import { fedsDeFotosPermitidos, puedeVerAccion, puedeVerAgendaDe, veTodoElEquipo, type Quien } from '@/lib/permisos'

const fed: Quien = { id: 'a', esAdmin: false, rol: 'fed' }
const admin: Quien = { id: 'b', esAdmin: true, rol: 'fed' }
const ced: Quien = { id: 'c', esAdmin: false, rol: 'coordinacion' }

describe('permisos por rol', () => {
  it('solo la coordinación y la administración ven todo el equipo', () => {
    expect([fed, admin, ced].map(veTodoElEquipo)).toEqual([false, true, true])
  })
  it('un FED ve su agenda y no la de otro', () => {
    expect(puedeVerAgendaDe(fed, 'a')).toBe(true)
    expect(puedeVerAgendaDe(fed, 'z')).toBe(false)
    expect(puedeVerAgendaDe(ced, 'z')).toBe(true)
    expect(puedeVerAgendaDe(admin, 'z')).toBe(true)
  })
  it('una acción la ve quien la creó, quien está etiquetado y quien ve todo', () => {
    expect(puedeVerAccion(fed, { fed_id: 'a', participantes: [] })).toBe(true)
    expect(puedeVerAccion(fed, { fed_id: 'z', participantes: ['a'] })).toBe(true)
    expect(puedeVerAccion(fed, { fed_id: 'z', participantes: ['y'] })).toBe(false)
    expect(puedeVerAccion(ced, { fed_id: 'z', participantes: [] })).toBe(true)
  })
  it('las carpetas de fotos: un FED pide la suya y las de su acción compartida', () => {
    expect(fedsDeFotosPermitidos(fed, ['a', 'z', 'y'])).toEqual(['a'])
    expect(fedsDeFotosPermitidos(fed, ['a', 'z', 'y'], { fed_id: 'z', participantes: ['a'] })).toEqual(['a', 'z'])
    expect(fedsDeFotosPermitidos(fed, ['z', 'y'], { fed_id: 'z', participantes: ['x'] })).toEqual([])
    expect(fedsDeFotosPermitidos(ced, ['a', 'z', 'y'])).toEqual(['a', 'z', 'y'])
  })
})
