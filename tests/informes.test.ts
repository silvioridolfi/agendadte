import { describe, expect, it } from 'vitest'
import type { AgendaItem } from '@/lib/agenda'
import { indicadoresCoordinacion, informeFed } from '@/lib/informes'

let n = 0
const it_ = (p: Partial<AgendaItem>): AgendaItem => ({ id: `i${++n}`, fed_id: 'f1', school_id: null, fecha: '2026-10-01', hora_inicio: null, hora_fin: null, accion: 'VISITA TÉCNICA', sub_accion: null, detalle: null, estado: 'realizada', cantidad: null, lugar: null, origen: 'app', created_at: '', updated_at: '', school: null, encuentros: [], participantes: [], ...p } as AgendaItem)
const escuela = (id: string) => ({ school_id: id, school: { id, cue: 60000001, nombre: 'EP', distrito: 'LA PLATA', ciudad: null } })
const val = (l: { clave: string, valor: number }[], k: string) => l.find(x => x.clave === k)!.valor

describe('indicadores de coordinación', () => {
  const ced = new Set(['c1'])
  const equipo = [
    it_({ fed_id: 'c1', accion: 'REUNIÓN' }),
    it_({ fed_id: 'c1', accion: 'REUNIÓN', estado: 'planificada' }), // no cuenta
    it_({ fed_id: 'f1', accion: 'REUNIÓN' }), // reunión de un FED: no es de coordinación
    it_({ fed_id: 'c1', accion: 'SEGUIMIENTO DEL EQUIPO' }),
    it_({ fed_id: 'c1', accion: 'ACOMPAÑAMIENTO A FED', ...escuela('s1') }),
    it_({ fed_id: 'c1', accion: 'REUNIÓN CON JEFATURA' }),
    it_({ fed_id: 'c1', accion: 'REUNIÓN CON INSPECCIÓN', ...escuela('s1') }),
    it_({ fed_id: 'c1', accion: 'INFORME TÉCNICO' }),
    it_({ accion: 'CLUB DE TECNOLOGÍA', club_id: 'k1' }), it_({ accion: 'CLUB DE TECNOLOGÍA', club_id: 'k1' }), it_({ accion: 'CLUB DE TECNOLOGÍA', club_id: 'k2' }),
    it_({ accion: 'PRÁCTICAS PROFESIONALIZANTES', club_id: 'p1', encuentros: [{ club_id: 'p1', inscriptos: 12 }, { club_id: 'p1', inscriptos: 15 }] as never }),
    it_({ accion: 'TALLER/CAPACITACIÓN' }), it_({ accion: 'FORMACIÓN INTERNA', rol_formacion: 'La dicté' }), it_({ accion: 'FORMACIÓN INTERNA', rol_formacion: 'Asistí' }),
    it_({ accion: 'EVENTO DTE' }), it_({ fed_id: 'f2', accion: 'EVENTO DTE' }),
  ]
  const ind = indicadoresCoordinacion(equipo, ced)
  it('cuenta según la planificación', () => {
    expect(val(ind, 'reuniones')).toBe(1)
    expect(val(ind, 'seguimientos')).toBe(2)
    expect(val(ind, 'instituciones')).toBe(1)
    expect(val(ind, 'clubes')).toBe(2)
    expect(val(ind, 'peat')).toBe(15)
    expect(val(ind, 'formacion')).toBe(2)
    expect(val(ind, 'jed')).toBe(2)
    expect(val(ind, 'informes')).toBe(1)
    expect(val(ind, 'articulaciones')).toBe(2)
  })
})

describe('informe de un FED', () => {
  it('resume sus acciones realizadas', () => {
    const inf = informeFed([
      it_({ ...escuela('s1') }), it_({ ...escuela('s1') }), it_({ ...escuela('s2'), accion: 'VISITA PEDAGÓGICA' }),
      it_({ accion: 'CLUB DE TECNOLOGÍA', encuentros: [{ asistentes: 10 }] as never }), it_({ accion: 'REUNIÓN' }), it_({ estado: 'cancelada' }),
    ])
    expect(val(inf, 'total')).toBe(5)
    expect(val(inf, 'tecnica')).toBe(2)
    expect(val(inf, 'pedagogica')).toBe(2)
    expect(val(inf, 'escuelas')).toBe(2)
    expect(inf.find(x => x.clave === 'encuentros')!.detalle).toBe('10 asistentes en total')
  })
})
