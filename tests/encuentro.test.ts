import { describe, expect, it } from 'vitest'
import { estadoAlCompletar, horariosSePisan, minEncuentros, proximoEncuentro, textoMinimo } from '@/lib/encuentro'

describe('mínimo de encuentros (sólo informativo)', () => {
  it('los clubes tienen mínimo 8; las prácticas y el resto, ninguno', () => {
    expect(minEncuentros('CLUB DE TECNOLOGÍA')).toBe(8)
    expect(minEncuentros('PRÁCTICAS PROFESIONALIZANTES')).toBeNull()
    expect(minEncuentros('VISITA TÉCNICA')).toBeNull()
    expect(minEncuentros(null)).toBeNull()
  })
  it('el texto dice cuánto falta o que está cumplido, y no aparece en prácticas', () => {
    expect(textoMinimo('CLUB DE TECNOLOGÍA', 3)).toBe('mínimo 8 · faltan 5')
    expect(textoMinimo('CLUB DE TECNOLOGÍA', 8)).toBe('mínimo 8 · cumplido')
    expect(textoMinimo('CLUB DE TECNOLOGÍA', 11)).toBe('mínimo 8 · cumplido') // después del mínimo no importa cuántos más
    expect(textoMinimo('PRÁCTICAS PROFESIONALIZANTES', 3)).toBe('')
  })
})

describe('número del próximo encuentro', () => {
  it('sin encuentros, el 1', () => expect(proximoEncuentro([])).toBe(1))
  it('sigue al mayor número cargado', () => {
    const e = (n: number | null, f: string) => ({ encuentro_n: n, fecha: f })
    expect(proximoEncuentro([e(1, '2026-08-05'), e(2, '2026-08-07'), e(10, '2026-09-28')])).toBe(11)
  })
  it('sin números cargados, cuenta las fechas distintas (dos grupos el mismo día son un encuentro)', () => {
    const e = (f: string) => ({ encuentro_n: null, fecha: f })
    expect(proximoEncuentro([e('2026-08-05'), e('2026-08-05'), e('2026-08-07')])).toBe(3)
  })
})

describe('pasa a realizada al completar el encuentro', () => {
  const base = { accion: 'CLUB DE TECNOLOGÍA', estado: 'planificada' as const, fecha: '2026-09-30', hoy: '2026-09-30', inscriptos: '', asistentes: '', descripcion: '', esCierre: false }
  it('con datos cargados, una acción de hoy planificada pasa a realizada', () => {
    expect(estadoAlCompletar({ ...base, asistentes: '18' })).toBe('realizada')
    expect(estadoAlCompletar({ ...base, inscriptos: '20' })).toBe('realizada')
    expect(estadoAlCompletar({ ...base, descripcion: 'Robótica con kits' })).toBe('realizada')
    expect(estadoAlCompletar({ ...base, esCierre: true })).toBe('realizada')
  })
  it('también las de días anteriores y las reprogramadas', () => {
    expect(estadoAlCompletar({ ...base, fecha: '2026-09-28', asistentes: '15' })).toBe('realizada')
    expect(estadoAlCompletar({ ...base, estado: 'reprogramada', asistentes: '15' })).toBe('realizada')
  })
  it('sin datos no cambia (vacío o sólo espacios); un cero sí es un dato', () => {
    expect(estadoAlCompletar(base)).toBe('planificada')
    expect(estadoAlCompletar({ ...base, descripcion: '   ' })).toBe('planificada')
    expect(estadoAlCompletar({ ...base, asistentes: '0' })).toBe('realizada')
  })
  it('las futuras, las canceladas y las que ya están realizadas no se tocan', () => {
    expect(estadoAlCompletar({ ...base, fecha: '2026-10-02', asistentes: '15' })).toBe('planificada')
    expect(estadoAlCompletar({ ...base, estado: 'cancelada', asistentes: '15' })).toBe('cancelada')
    expect(estadoAlCompletar({ ...base, estado: 'realizada' })).toBe('realizada')
  })
  it('sólo clubes y prácticas', () => {
    expect(estadoAlCompletar({ ...base, accion: 'PRÁCTICAS PROFESIONALIZANTES', asistentes: '10' })).toBe('realizada')
    expect(estadoAlCompletar({ ...base, accion: 'VISITA TÉCNICA', asistentes: '10' })).toBe('planificada')
    expect(estadoAlCompletar({ ...base, accion: null, asistentes: '10' })).toBe('planificada')
  })
})

describe('choque de horarios', () => {
  it('uno a continuación del otro no se pisa', () => {
    expect(horariosSePisan({ ini: '12:00', fin: '13:00' }, { ini: '13:00', fin: '14:00' })).toBe(false)
    expect(horariosSePisan({ ini: '13:00', fin: '14:00' }, { ini: '12:00', fin: '13:00' })).toBe(false)
  })
  it('si se superponen, sí', () => {
    expect(horariosSePisan({ ini: '12:00', fin: '13:30' }, { ini: '13:00', fin: '14:00' })).toBe(true)
    expect(horariosSePisan({ ini: '12:30', fin: '13:00' }, { ini: '12:00', fin: '14:00' })).toBe(true)
  })
  it('el mismo inicio se pisa', () => expect(horariosSePisan({ ini: '12:00', fin: '13:00' }, { ini: '12:00', fin: '15:00' })).toBe(true))
  it('sin horario no se puede decir', () => {
    expect(horariosSePisan({ ini: '', fin: '' }, { ini: '12:00', fin: '13:00' })).toBe(false)
    expect(horariosSePisan({ ini: '12:00', fin: '13:00' }, { ini: '', fin: '' })).toBe(false)
  })
})
