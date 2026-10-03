import { describe, expect, it } from 'vitest'
import { avisoDeCambio, conexionDe, filtrarReclamos, origenDeNumero, resumenReclamos, esAbierto, type Reclamo } from '@/lib/reclamos-registro'

const e = (plan_enlace: string, subplan_enlace: string, plan_piso_tecnologico: string | null) => ({ plan_enlace, subplan_enlace, plan_piso_tecnologico })

describe('tipo de conexión', () => {
  it('usa los mismos nombres que la planilla del CED', () => {
    expect(conexionDe(e('PNCE', 'PNCE', 'PNCE'))).toBe('Piso y Enlace PNCE')
    expect(conexionDe(e('PBA', 'PBA GRUPO 2 A', 'PNCE'))).toBe('Piso PNCE y Enlace PBA')
    expect(conexionDe(e('PBA', 'PBA GRUPO 1', null))).toBe('Enlace PBA (Sin piso)')
    expect(conexionDe(e('PBA', 'PBA GRUPO 2 A', 'PBA'))).toBe('Piso y Enlace PBA')
    expect(conexionDe(e('Sin enlace', 'Sin enlace', null))).toBe('Sin datos de conectividad')
    expect(conexionDe(e('Sin enlace', 'Sin enlace', 'PNCE'))).toBe('Piso PNCE (Sin enlace)')
  })
})

describe('número de ticket o incidencia', () => {
  it.each([['NI-000234800', 'Educar'], ['NI-000159888 y NI-000176742', 'Educar'], ['ticket 337918', 'PBA'], ['incidente 336001', 'PBA'], ['PBA generó el ticket 336332', 'PBA'], ['337213.', 'PBA'], ['', null], ['solucionado NC avisó 3 de junio', null]])('%s', (n, esperado) => { expect(origenDeNumero(n)).toBe(esperado) })
})

describe('panel de reclamos', () => {
  const r = (id: string, p: Partial<Reclamo>): Reclamo => ({ id, fed_id: 'f1', school_id: 's', cue: 60897700, tipo: 'sin_conectividad', tipo_label: 'Sin Conectividad', conexion: 'Piso PNCE y Enlace PBA', asunto: '06-01-010120261000 - CUE 60897700 - Sin Conectividad', enviado_at: '2026-10-01T10:00:00Z', estado: 'enviado', nro_incidencia: null, notas: null, resuelto_at: null, origen: 'app', school: { nombre: 'EES N° 31', distrito: 'LA PLATA', ciudad: 'LA PLATA' }, ...p })
  const lista = [r('a', {}), r('b', { estado: 'en_proceso', fed_id: 'f2', nro_incidencia: 'ticket 337918', conexion: 'Piso y Enlace PNCE' }), r('c', { estado: 'resuelto' }), r('d', { estado: 'anulado' })]
  const base = { estado: 'abiertos' as const, fedId: '', conexion: '', busqueda: '' }
  const nombre = (id: string | null) => (id === 'f1' ? 'Silvio Ridolfi' : 'Carlos Franco')
  it('por defecto muestra los abiertos', () => {
    expect(filtrarReclamos(lista, base, nombre).map(x => x.id)).toEqual(['a', 'b'])
    expect(filtrarReclamos(lista, { ...base, estado: 'todos' }, nombre)).toHaveLength(4)
    expect(filtrarReclamos(lista, { ...base, estado: 'resuelto' }, nombre).map(x => x.id)).toEqual(['c'])
  })
  it('filtra por FED, conexión y búsqueda (CUE, escuela, número, nombre sin tildes)', () => {
    expect(filtrarReclamos(lista, { ...base, fedId: 'f2' }, nombre).map(x => x.id)).toEqual(['b'])
    expect(filtrarReclamos(lista, { ...base, conexion: 'Piso y Enlace PNCE' }, nombre).map(x => x.id)).toEqual(['b'])
    expect(filtrarReclamos(lista, { ...base, busqueda: '337918' }, nombre).map(x => x.id)).toEqual(['b'])
    expect(filtrarReclamos(lista, { ...base, busqueda: 'ridolfi' }, nombre).map(x => x.id)).toEqual(['a'])
    expect(filtrarReclamos(lista, { ...base, estado: 'todos', busqueda: 'ees n° 31' }, nombre)).toHaveLength(4)
  })
  it('cuenta por estado y distingue abiertos', () => {
    expect(resumenReclamos(lista)).toEqual({ enviados: 1, enProceso: 1, resueltos: 1 })
    expect(esAbierto('enviado') && esAbierto('en_proceso') && !esAbierto('resuelto') && !esAbierto('anulado')).toBe(true)
  })
})

describe('aviso al FED cuando cambia su reclamo', () => {
  const rec = { cue: 60304400, tipo_label: 'Sin Conectividad' }
  it('avisa cuando llega el número', () => {
    expect(avisoDeCambio({ estado: 'enviado', nro_incidencia: null }, { estado: 'en_proceso', nro_incidencia: 'ticket 337900' }, rec)).toBe('Llegó el número del reclamo de CUE 60304400 · Sin Conectividad: ticket 337900')
  })
  it('avisa cuando se resuelve, con el número si lo hay', () => {
    expect(avisoDeCambio({ estado: 'en_proceso', nro_incidencia: 'NI-000234800' }, { estado: 'resuelto', nro_incidencia: 'NI-000234800' }, rec)).toBe('Se resolvió el reclamo de CUE 60304400 · Sin Conectividad (NI-000234800)')
    expect(avisoDeCambio({ estado: 'enviado', nro_incidencia: null }, { estado: 'resuelto', nro_incidencia: null }, rec)).toBe('Se resolvió el reclamo de CUE 60304400 · Sin Conectividad')
  })
  it('no avisa si no cambió el número ni se resolvió, ni al anular', () => {
    expect(avisoDeCambio({ estado: 'en_proceso', nro_incidencia: 'x' }, { estado: 'en_proceso', nro_incidencia: 'x' }, rec)).toBeNull()
    expect(avisoDeCambio({ estado: 'enviado', nro_incidencia: null }, { estado: 'anulado', nro_incidencia: null }, rec)).toBeNull()
    expect(avisoDeCambio({ estado: 'resuelto', nro_incidencia: 'x' }, { estado: 'resuelto', nro_incidencia: 'x' }, rec)).toBeNull()
  })
})
