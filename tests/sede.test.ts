import { describe, expect, it } from 'vitest'
import { CUE_DTE, GRUPO_DTE, GRUPO_VIRTUAL, SIN_ESCUELA, esEscuela, grupoDistrito, ordenGrupos } from '@/lib/sede'

const dte = { cue: CUE_DTE, distrito: 'LA PLATA' }
const escuela = { cue: 60416600, distrito: 'BERISSO' }

describe('sede DTE y encuentros virtuales', () => {
  it('los encuentros virtuales van a "Virtual", aunque la sede sea la DTE o una escuela', () => {
    expect(grupoDistrito({ school: dte, modalidad: 'Virtual' })).toBe(GRUPO_VIRTUAL)
    expect(grupoDistrito({ school: escuela, modalidad: 'Virtual' })).toBe(GRUPO_VIRTUAL)
  })
  it('lo presencial con sede DTE va a "DTE / institucional", no a La Plata', () => {
    expect(grupoDistrito({ school: dte, modalidad: 'Presencial' })).toBe(GRUPO_DTE)
    expect(grupoDistrito({ school: { cue: String(CUE_DTE) as unknown as number, distrito: 'LA PLATA' } })).toBe(GRUPO_DTE)
  })
  it('una escuela cuenta en su distrito; sin escuela, aparte', () => {
    expect(grupoDistrito({ school: escuela })).toBe('BERISSO')
    expect(grupoDistrito({ school: null })).toBe(SIN_ESCUELA)
  })
  it('la DTE no cuenta como escuela alcanzada', () => {
    expect(esEscuela(dte)).toBe(false)
    expect(esEscuela(escuela)).toBe(true)
    expect(esEscuela(null)).toBe(false)
  })
  it('distritos alfabéticos y los grupos especiales al final', () => {
    expect([SIN_ESCUELA, GRUPO_DTE, 'LA PLATA', GRUPO_VIRTUAL, 'BERISSO'].sort(ordenGrupos)).toEqual(['BERISSO', 'LA PLATA', GRUPO_VIRTUAL, GRUPO_DTE, SIN_ESCUELA])
  })
})
