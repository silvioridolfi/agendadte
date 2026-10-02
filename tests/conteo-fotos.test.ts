import { describe, expect, it } from 'vitest'
import { fotosDe } from '@/lib/conteo-fotos'
import type { ConteoFotos } from '@/app/actions'

const it_ = (id: string, p: Partial<Parameters<typeof fotosDe>[0]> = {}) => ({ id, fed_id: 'f1', fecha: '2026-10-02', participantes: [], ...p })
const conteo = (c: Partial<ConteoFotos>): ConteoFotos => ({ items: {}, dias: {}, sueltas: {}, ...c })

describe('marca de fotos de una acción', () => {
  // Caso real: 10 fotos del día, todas asignadas por horario a los tres clubes.
  const hoy = conteo({ items: { club1: 2, club2: 4, club3: 4 }, dias: { 'f1|2026-10-02': 10 } })
  it('muestra las fotos propias de la acción', () => {
    expect(fotosDe(it_('club1'), hoy)).toEqual({ n: 2, deAccion: true })
  })
  it('no muestra fotos en una acción sin fotos si las del día ya pertenecen a otras', () => {
    expect(fotosDe(it_('oficina'), hoy)).toEqual({ n: 0, deAccion: false })
  })
  it('si quedaron fotos del día sin acción, cuentan para las acciones sin fotos', () => {
    expect(fotosDe(it_('oficina'), conteo({ ...hoy, dias: { 'f1|2026-10-02': 12 }, sueltas: { 'f1|2026-10-02': 2 } }))).toEqual({ n: 2, deAccion: false })
  })
  it('suma las sueltas de quienes participaron', () => {
    expect(fotosDe(it_('x', { participantes: [{ fed_id: 'f2' }] as never }), conteo({ sueltas: { 'f2|2026-10-02': 3 } }))).toEqual({ n: 3, deAccion: false })
  })
  it('sin conteo cargado no hay marca', () => {
    expect(fotosDe(it_('x'), null)).toBeNull()
  })
})
