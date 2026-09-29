import { describe, expect, it } from 'vitest'
import { ACCIONES_REUNION, conEnlace, enlaceDe, esReunion, MENSAJE_ENLACE, normalizarEnlace } from '@/lib/reunion'

describe('reuniones virtuales', () => {
  it('son reuniones las cinco acciones de reunión y ninguna otra', () => {
    expect(ACCIONES_REUNION).toHaveLength(5)
    for (const a of ['REUNIÓN', 'REUNIÓN CON JEFATURA', 'REUNIÓN CON INSPECCIÓN', 'REUNIÓN CON NIVEL CENTRAL', 'ARTICULACIÓN MUNICIPAL'] as const) expect(esReunion(a)).toBe(true)
    for (const a of ['VISITA TÉCNICA', 'CLUB DE TECNOLOGÍA', 'FORMACIÓN INTERNA', 'EVENTO DTE', 'SEGUIMIENTO DEL EQUIPO'] as const) expect(esReunion(a)).toBe(false)
    expect(esReunion(null)).toBe(false)
  })
  it('virtual e híbrida llevan enlace; presencial no', () => {
    expect(conEnlace('Virtual')).toBe(true)
    expect(conEnlace('Híbrido')).toBe(true)
    expect(conEnlace('Presencial')).toBe(false)
    expect(conEnlace(null)).toBe(false)
  })
  it('acepta enlaces https y los limpia', () => {
    expect(normalizarEnlace('  https://meet.google.com/abc-defg-hij ')).toBe('https://meet.google.com/abc-defg-hij')
    expect(normalizarEnlace('https://zoom.us/j/123456789?pwd=abc')).toBe('https://zoom.us/j/123456789?pwd=abc')
  })
  it('si falta el https:// y parece una dirección, se lo agrega', () => {
    expect(normalizarEnlace('meet.google.com/abc-defg-hij')).toBe('https://meet.google.com/abc-defg-hij')
    expect(normalizarEnlace('us02web.zoom.us/j/123')).toBe('https://us02web.zoom.us/j/123')
  })
  it('vacío no es error: no hay enlace', () => {
    expect(normalizarEnlace('')).toBeNull()
    expect(normalizarEnlace('   ')).toBeNull()
    expect(normalizarEnlace(null)).toBeNull()
  })
  it('rechaza lo que no es un enlace https', () => {
    for (const malo of ['http://meet.google.com/abc', 'javascript:alert(1)', 'ftp://x.com/a', 'https://', 'https:// meet.google.com', 'hola que tal', 'meet', `https://a.com/${'x'.repeat(500)}`])
      expect(() => normalizarEnlace(malo), malo).toThrow(MENSAJE_ENLACE)
  })
  it('sólo las reuniones no presenciales guardan el enlace', () => {
    const l = 'https://meet.google.com/abc-defg-hij'
    expect(enlaceDe('REUNIÓN', 'Virtual', l)).toBe(l)
    expect(enlaceDe('REUNIÓN CON JEFATURA', 'Híbrido', l)).toBe(l)
    expect(enlaceDe('REUNIÓN', 'Presencial', l)).toBeNull()
    expect(enlaceDe('REUNIÓN', null, l)).toBeNull()
    expect(enlaceDe('VISITA TÉCNICA', 'Virtual', l)).toBeNull()
    expect(enlaceDe('REUNIÓN', 'Virtual', '')).toBeNull()
    expect(() => enlaceDe('REUNIÓN', 'Virtual', 'no es un enlace')).toThrow(MENSAJE_ENLACE)
  })
})
