import { describe, expect, it } from 'vitest'
import { alternarTipo, datosVacios, esSumable, inputDeTipo } from '../lib/visita'
import type { AgendaItemInput } from '../lib/agenda'

const base: AgendaItemInput = {
  fed_id: 'f1', school_id: 's1', lugar: null, fecha: '2026-10-01', hora_inicio: '09:00', hora_fin: '11:00',
  accion: 'VISITA TÉCNICA', estado: 'planificada', sub_accion: 'Desbloqueos', detalle: 'principal', cantidad: 4,
  encuentro: null, participantes: ['f2'], repeticion: null,
}

describe('visita con varias acciones', () => {
  it('suma tipos combinables y los quita al volver a tocarlos', () => {
    expect(alternarTipo(['VISITA TÉCNICA'], 'CONECTIVIDAD')).toEqual(['VISITA TÉCNICA', 'CONECTIVIDAD'])
    expect(alternarTipo(['VISITA TÉCNICA', 'CONECTIVIDAD'], 'VISITA TÉCNICA')).toEqual(['CONECTIVIDAD'])
    expect(alternarTipo(['VISITA TÉCNICA'], 'TALLER/CAPACITACIÓN')).toEqual(['VISITA TÉCNICA', 'TALLER/CAPACITACIÓN'])
    expect(alternarTipo(['VISITA TÉCNICA'], 'VISITA PEDAGÓGICA')).toEqual(['VISITA TÉCNICA', 'VISITA PEDAGÓGICA'])
  })
  it('club, PEAT, paro y licencia no se combinan: reemplazan la selección', () => {
    expect(alternarTipo(['VISITA TÉCNICA', 'CONECTIVIDAD'], 'CLUB DE TECNOLOGÍA')).toEqual(['CLUB DE TECNOLOGÍA'])
    expect(alternarTipo(['CLUB DE TECNOLOGÍA'], 'VISITA TÉCNICA')).toEqual(['VISITA TÉCNICA'])
    expect(alternarTipo(['VISITA TÉCNICA'], 'LICENCIA')).toEqual(['LICENCIA'])
    expect(esSumable('PRÁCTICAS PROFESIONALIZANTES')).toBe(false)
    expect(esSumable('PARO')).toBe(false)
  })
  it('cada tipo adicional conserva los datos comunes y usa los propios', () => {
    const d = { ...datosVacios(), sub_accion: ' Router ', cantidad: '2', detalle: 'extra' }
    const r = inputDeTipo(base, 'CONECTIVIDAD', d)
    expect(r).toMatchObject({ accion: 'CONECTIVIDAD', school_id: 's1', fecha: '2026-10-01', hora_inicio: '09:00', participantes: ['f2'], sub_accion: 'Router', cantidad: 2, detalle: 'extra', encuentro: null })
  })
  it('las pedagógicas no llevan cantidad y los talleres llevan los datos del encuentro', () => {
    const r = inputDeTipo(base, 'TALLER/CAPACITACIÓN', { ...datosVacios(), cantidad: '9', propuesta: 'Ciudadanía digital', inscriptos: '25', asistentes: '22' })
    expect(r.cantidad).toBeNull()
    expect(r.encuentro).toMatchObject({ propuesta: 'Ciudadanía digital', inscriptos: 25, asistentes: 22, modalidad: 'Presencial' })
    expect(inputDeTipo(base, 'VISITA PEDAGÓGICA', datosVacios()).encuentro).toBeNull()
  })
})
