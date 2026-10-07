import { describe, expect, it } from 'vitest'
import { gruposPorPredio, hermanasDe, predioValido, textoPredio } from '@/lib/predio'

const filas = [
  { id: 'a', cue: 1, nombre: 'JI N° 9', predio: 606349 },
  { id: 'b', cue: 2, nombre: 'EP N° 4', predio: '606349' },
  { id: 'c', cue: 3, nombre: 'EES N° 31', predio: 606349 },
  { id: 'd', cue: 4, nombre: 'EP N° 7', predio: 700000 },
  { id: 'e', cue: 5, nombre: 'Sin predio', predio: null },
  { id: 'f', cue: 6, nombre: 'Predio cero', predio: 0 },
  { id: 'g', cue: 7, nombre: 'Otra en cero', predio: 0 },
]
describe('predio compartido', () => {
  const g = gruposPorPredio(filas)
  it('agrupa por número y descarta vacíos y ceros', () => {
    expect([...g.keys()].sort()).toEqual([606349, 700000])
    expect(predioValido(null)).toBeNull(); expect(predioValido(0)).toBeNull(); expect(predioValido('x')).toBeNull(); expect(predioValido(' 12 ')).toBe(12)
  })
  it('las hermanas no incluyen a la propia y salen por nombre', () => {
    expect(hermanasDe(g, 'a', 606349).map(h => h.id)).toEqual(['c', 'b'])
    expect(hermanasDe(g, 'd', 700000)).toEqual([])
    expect(hermanasDe(g, 'f', 0)).toEqual([])
    expect(hermanasDe(g, 'e', null)).toEqual([])
  })
  it('el texto concuerda en singular y plural', () => {
    expect(textoPredio(606349, 2)).toBe('Predio 606349 · comparte con 2 escuelas')
    expect(textoPredio(606349, 1)).toBe('Predio 606349 · comparte con 1 escuela')
    expect(textoPredio(null, 2)).toBe(''); expect(textoPredio(606349, 0)).toBe('')
  })
})
