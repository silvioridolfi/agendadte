import { describe, expect, it } from 'vitest'
import { coincideEscuela } from '@/lib/buscador'

const ees31 = { nombre: 'ESCUELA DE EDUCACIÓN SECUNDARIA N° 31 "Dr. Fulano"', distrito: 'LA PLATA', ciudad: 'City Bell', cue: 61000001 }
const ees310 = { nombre: 'ESCUELA DE EDUCACIÓN SECUNDARIA N° 310', distrito: 'BERISSO', ciudad: 'Berisso', cue: 61000002 }
const eest1 = { nombre: 'ESCUELA DE EDUCACIÓN SECUNDARIA TÉCNICA N° 1', distrito: 'LA PLATA', ciudad: 'La Plata', cue: 61000003 }
const ext = { nombre: 'EXTENSIÓN N° 1 DE LA ESCUELA DE EDUCACIÓN SECUNDARIA N° 28', distrito: 'LA PLATA', ciudad: 'La Plata', cue: 61000004 }
const ji = { nombre: 'JARDÍN DE INFANTES N° 905 "Manuel Belgrano"', distrito: 'ENSENADA', ciudad: 'Ensenada', cue: 60393200 }
const q = (c: string, e: Parameters<typeof coincideEscuela>[1], extra = '') => coincideEscuela(c, e, extra)

describe('buscador común de escuelas', () => {
  it('sin tildes ni mayúsculas y todas las palabras en cualquier orden', () => {
    expect(q('jardin belgrano', ji)).toBe(true)
    expect(q('BELGRANO JARDÍN', ji)).toBe(true)
    expect(q('jardin ensenada', ji)).toBe(true)
    expect(q('jardin berisso', ji)).toBe(false)
  })
  it('con sigla pide el tipo y el número propio', () => {
    expect(q('ees 31', ees31)).toBe(true)
    expect(q('ees n° 31', ees31)).toBe(true)
    expect(q('ees 31', ees310)).toBe(false)
    expect(q('ees 1', ees31)).toBe(false)
    expect(q('ees 1', eest1)).toBe(false)
    expect(q('eest 1', eest1)).toBe(true)
    expect(q('ji 905', ji)).toBe(true)
    expect(q('ji 90', ji)).toBe(false)
  })
  it('la sigla suma otras palabras (distrito, nombre)', () => {
    expect(q('ees 31 city bell', ees31)).toBe(true)
    expect(q('ees 31 berisso', ees31)).toBe(false)
    expect(q('ees 31 fulano', ees31)).toBe(true)
  })
  it('las extensiones salen con la escuela pedida', () => {
    expect(q('ees 28', ext)).toBe(true)
    expect(q('ees 1', ext)).toBe(false)
  })
  it('un número solo coincide entero y un CUE largo, por el principio', () => {
    expect(q('31', ees31)).toBe(true)
    expect(q('31', ees310)).toBe(false)
    expect(q('6100', ees31)).toBe(true)
    expect(q('61000001', ees31)).toBe(true)
    expect(q('61000009', ees31)).toBe(false)
  })
  it('nombres ya abreviados también', () => {
    expect(q('ep 4 moreno', { nombre: 'EP N° 4 Mariano Moreno' })).toBe(true)
    expect(q('ep 5', { nombre: 'EP N° 4 Mariano Moreno' })).toBe(false)
  })
  it('las palabras del resto de la pantalla cuentan', () => {
    expect(q('dinatech', ees31, 'Dinatech ST NI-123')).toBe(true)
    expect(q('ees 31 dinatech', ees31, 'Dinatech ST')).toBe(true)
    expect(q('dinatech', ees31, 'OCP')).toBe(false)
  })
  it('sin palabras no filtra', () => {
    expect(q('', ees31)).toBe(true)
    expect(q('  n ', ees31)).toBe(true)
  })
})
