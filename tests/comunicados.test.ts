import { describe, expect, it } from 'vitest'
import { destinatariosDe, estadoComunicado, llegaA, ordenarPendientes, resumenLecturas, tramosConEnlaces, validarComunicado, type EntradaComunicado } from '@/lib/comunicados'

const ok: EntradaComunicado = { titulo: 'Reunión', texto: 'El jueves a las 10.', nivel: 'informativo', fedIds: null, venceEl: null }
const HOY = '2026-10-08'

describe('validarComunicado', () => {
  it('acepta uno completo', () => expect(validarComunicado(ok, HOY)).toBeNull())
  it('pide título, mensaje y destinatarios', () => {
    expect(validarComunicado({ ...ok, titulo: '  ' }, HOY)).toMatch(/título/)
    expect(validarComunicado({ ...ok, texto: '' }, HOY)).toMatch(/mensaje/)
    expect(validarComunicado({ ...ok, fedIds: [] }, HOY)).toMatch(/al menos un FED/)
  })
  it('respeta los largos', () => {
    expect(validarComunicado({ ...ok, titulo: 'x'.repeat(81) }, HOY)).toMatch(/80/)
    expect(validarComunicado({ ...ok, texto: 'x'.repeat(1501) }, HOY)).toMatch(/1500/)
    expect(validarComunicado({ ...ok, titulo: 'x'.repeat(80), texto: 'x'.repeat(1500) }, HOY)).toBeNull()
  })
  it('el vencimiento no puede estar en el pasado', () => {
    expect(validarComunicado({ ...ok, venceEl: '2026-10-07' }, HOY)).toMatch(/ya pasó/)
    expect(validarComunicado({ ...ok, venceEl: HOY }, HOY)).toBeNull()
    expect(validarComunicado({ ...ok, venceEl: '8/10' }, HOY)).toMatch(/no es válida/)
  })
})

describe('estado y destinatarios', () => {
  it('estado según retiro y vencimiento', () => {
    expect(estadoComunicado({ retirado: false, vence_el: null }, HOY)).toBe('vigente')
    expect(estadoComunicado({ retirado: false, vence_el: HOY }, HOY)).toBe('vigente')
    expect(estadoComunicado({ retirado: false, vence_el: '2026-10-07' }, HOY)).toBe('vencido')
    expect(estadoComunicado({ retirado: true, vence_el: null }, HOY)).toBe('retirado')
  })
  const feds = [{ id: 'a', rol: 'fed' }, { id: 'b', rol: 'fed' }, { id: 'c', rol: 'coordinacion' }]
  it('a todos los FED, sin la coordinación; o a los elegidos', () => {
    expect(destinatariosDe({ fed_ids: null }, feds).map(f => f.id)).toEqual(['a', 'b'])
    expect(destinatariosDe({ fed_ids: ['b'] }, feds).map(f => f.id)).toEqual(['b'])
    expect(llegaA({ fed_ids: null }, feds[0])).toBe(true)
    expect(llegaA({ fed_ids: null }, feds[2])).toBe(false)
    expect(llegaA({ fed_ids: ['a'] }, feds[1])).toBe(false)
  })
})

describe('orden, lecturas y enlaces', () => {
  it('importantes primero y, dentro, el más nuevo', () => {
    const l = [{ id: 1, nivel: 'informativo' as const, created_at: '2026-10-08' }, { id: 2, nivel: 'importante' as const, created_at: '2026-10-01' }, { id: 3, nivel: 'importante' as const, created_at: '2026-10-05' }]
    expect(ordenarPendientes(l).map(x => x.id)).toEqual([3, 2, 1])
  })
  it('cuenta las lecturas', () => expect(resumenLecturas([{ leidoAt: 'x' }, { leidoAt: null }, { leidoAt: 'y' }])).toEqual({ leidos: 2, total: 3 }))
  it('separa los enlaces sin tomar la puntuación final', () => {
    expect(tramosConEnlaces('Mirá https://a.com/x, y también http://b.org.')).toEqual([
      { texto: 'Mirá ' }, { texto: 'https://a.com/x', enlace: 'https://a.com/x' }, { texto: ', y también ' }, { texto: 'http://b.org', enlace: 'http://b.org' }, { texto: '.' },
    ])
    expect(tramosConEnlaces('sin enlaces')).toEqual([{ texto: 'sin enlaces' }])
    expect(tramosConEnlaces('javascript:alert(1)')).toEqual([{ texto: 'javascript:alert(1)' }])
  })
})
