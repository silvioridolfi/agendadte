import { describe, expect, it, vi } from 'vitest'
import { ACCIONES, ACCIONES_CED, SOLO_CED, CLUB_MIN_ENCUENTROS, nombreAccion } from '@/lib/agenda'
import { DESTINATARIOS_BASE, PROPUESTAS_DE_CLUB } from '@/lib/encuentro'
import { NOVEDADES } from '@/lib/ayuda/novedades'
import { ALCANCE_CED, TEMAS } from '@/lib/ayuda/temas'
import { ATAJOS, ESTILO_TEMA } from '@/lib/ayuda/estilo'
import { normalizar, parsear, partesNegrita, textoPlano } from '@/lib/ayuda/formato'
vi.mock('server-only', () => ({}))

const texto = (id: string) => TEMAS.find(t => t.id === id)!.md()
const todo = TEMAS.map(t => `${t.titulo}\n${t.md()}`).join('\n')

describe('formato de la ayuda', () => {
  it('arma subtítulos, listas, pasos, tablas y avisos', () => {
    const b = parsear('## Título\nTexto con **negrita**\n- uno\n- dos\n1. paso\n2. paso\n| A | B |\n|---|---|\n| 1 | 2 |\n[!] Importante\n[i] Dato\n[!!] Cuidado')
    expect(b.map(x => x.t)).toEqual(['sub', 'p', 'lista', 'pasos', 'tabla', 'aviso', 'aviso', 'aviso'])
    expect(b[2]).toEqual({ t: 'lista', items: ['uno', 'dos'] })
    expect(b[4]).toEqual({ t: 'tabla', filas: [['A', 'B'], ['1', '2']] })
    expect(b.slice(5).map(x => (x.t === 'aviso' ? x.nivel : ''))).toEqual(['importante', 'info', 'atencion'])
  })
  it('negrita, texto plano y búsqueda sin tildes', () => {
    expect(partesNegrita('a **b** c')).toEqual([['a ', false], ['b', true], [' c', false]])
    expect(textoPlano({ t: 'lista', items: ['**x** y'] })).toBe('x y')
    expect(normalizar('Planilla de Visita á Escuelas')).toBe('planilla de visita a escuelas')
  })
})

describe('contenido de la ayuda', () => {
  it('ids únicos y cada tema tiene contenido', () => {
    expect(new Set(TEMAS.map(t => t.id)).size).toBe(TEMAS.length)
    for (const t of TEMAS) expect(parsear(t.md()).length, t.id).toBeGreaterThan(1)
  })
  it('cada rol tiene su manual', () => {
    expect(TEMAS.filter(t => t.para.includes('fed')).length).toBeGreaterThan(8)
    expect(TEMAS.filter(t => t.para.includes('ced')).length).toBeGreaterThan(8)
  })
  it('nombra todos los tipos de acción: los de los FED en el registro y los de la coordinación en Mi agenda', () => {
    for (const a of ACCIONES.filter(a => !SOLO_CED.includes(a))) expect(texto('registro'), a).toContain(nombreAccion(a))
    for (const a of ACCIONES_CED) { expect(texto('ced-agenda'), a).toContain(nombreAccion(a)) }
  })
  it('cada tipo propio de la coordinación tiene su alcance explicado (al sumar un tipo, hay que describirlo)', () => {
    for (const a of SOLO_CED) expect(ALCANCE_CED[a], a).toBeTruthy()
  })
  it('las reglas salen del código', () => {
    expect(texto('clubes')).toContain(`**${CLUB_MIN_ENCUENTROS} encuentros**`)
    for (const p of PROPUESTAS_DE_CLUB.slice(1, 3)) expect(texto('clubes')).toContain(p)
    for (const d of DESTINATARIOS_BASE) expect(texto('clubes')).toContain(d)
    expect(texto('pve')).toContain('5.º día hábil')
  })
  it('no menciona la geolocalización de las fotos', () => {
    expect(todo).not.toMatch(/geolocaliz|\bgps\b|exif|coordenadas|ubicaci[oó]n de (la|las) fotos?/i)
  })
})

describe('identidad visual', () => {
  it('cada tema tiene familia de color e ícono, y los atajos apuntan a temas de su rol', () => {
    for (const t of TEMAS) expect(ESTILO_TEMA[t.id], t.id).toBeTruthy()
    for (const rol of ['fed', 'ced'] as const) for (const a of ATAJOS[rol]) expect(TEMAS.find(t => t.id === a.id)?.para, a.id).toContain(rol)
  })
})

describe('novedades', () => {
  it('ordenadas de la más reciente a la más antigua y con texto', () => {
    const f = NOVEDADES.map(n => n.fecha)
    expect([...f].sort().reverse()).toEqual(f)
    for (const n of NOVEDADES) { expect(n.titulo.length).toBeGreaterThan(3); expect(n.texto.length).toBeGreaterThan(10) }
  })
})
