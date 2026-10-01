import { describe, expect, it } from 'vitest'
import { claseDestacado, type Destacados } from '@/lib/destacados'

const nada: Destacados = { guardado: null, realizadas: new Set() }

describe('destacados', () => {
  it('sin nada destacado no hay clase', () => {
    expect(claseDestacado(nada, { id: 'a' })).toEqual({ clase: '', realizada: false })
  })
  it('la acción recién guardada hace un destello', () => {
    expect(claseDestacado({ guardado: 'a', realizadas: new Set() }, { id: 'a' }).clase).toBe('anim-destello')
    expect(claseDestacado({ guardado: 'a', realizadas: new Set() }, { id: 'b' }).clase).toBe('')
  })
  it('las recién realizadas muestran el sello, y una visita cuenta si alguna de sus acciones lo está', () => {
    expect(claseDestacado({ guardado: null, realizadas: new Set(['b']) }, { id: 'a', visita: [{ id: 'a' }, { id: 'b' }] })).toEqual({ clase: 'anim-realizada', realizada: true })
  })
  it('lo realizado pesa más que lo guardado', () => {
    expect(claseDestacado({ guardado: 'a', realizadas: new Set(['a']) }, { id: 'a' }).clase).toBe('anim-realizada')
  })
})
