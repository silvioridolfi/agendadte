import { beforeEach, describe, expect, it, vi } from 'vitest'

// Reclamos, cronogramas y eventos: quién puede hacer qué, con la base simulada.
type Op = { m: string, args: unknown[] }
type Llamada = { tabla: string, ops: Op[] }
type Respuesta = { data?: unknown, error?: { message: string, code?: string } | null }
const estado = vi.hoisted(() => ({ responder: (_l: Llamada): Respuesta => ({}), llamadas: [] as Llamada[] }))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase-server', () => ({
  supabaseServer: () => ({
    from: (tabla: string) => {
      const l: Llamada = { tabla, ops: [] }
      estado.llamadas.push(l)
      const cadena: unknown = new Proxy({}, {
        get: (_, m: string) => {
          if (m === 'then') return (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(estado.responder(l)).then(r => ({ data: r.data ?? null, error: r.error ?? null })).then(ok, ko)
          return (...args: unknown[]) => { l.ops.push({ m, args }); return cadena }
        },
      })
      return cadena
    },
  }),
}))

import * as R from '@/lib/servidor/reclamos-cronogramas'
import * as E from '@/lib/servidor/eventos'

const UID = '11111111-1111-4111-8111-111111111111'
const yoFed = { fed: { id: 'f1', nombre_completo: 'Ana Pérez', rol: 'fed' }, userId: 'u1', email: 'a@x', esAdmin: false, debeCambiar: false } as never
const yoCed = { fed: { id: 'c1', nombre_completo: 'Julio', rol: 'coordinacion' }, userId: 'u2', email: 'c@x', esAdmin: false, debeCambiar: false } as never
const yoAdmin = { fed: { id: 'a1', nombre_completo: 'Silvio', rol: 'fed' }, userId: 'u3', email: 's@x', esAdmin: true, debeCambiar: false } as never
const de = (tabla: string, m: string) => estado.llamadas.filter(l => l.tabla === tabla && l.ops.some(o => o.m === m))
beforeEach(() => { estado.llamadas = []; estado.responder = () => ({}) })

describe('reclamos', () => {
  it('sólo la coordinación actualiza el registro', async () => {
    await expect(R.actualizarReclamoImpl(yoFed, UID, { estado: 'resuelto' })).rejects.toThrow('coordinación')
    await expect(R.actualizarReclamoImpl(yoAdmin, UID, { estado: 'resuelto' })).rejects.toThrow('coordinación')
    expect(estado.llamadas).toHaveLength(0)
  })
  it('rechaza ids que no son UUID', async () => {
    await expect(R.actualizarReclamoImpl(yoCed, 'x', {})).rejects.toThrow('inválido')
    await expect(R.resolverReclamoImpl(yoFed, 'x', null)).rejects.toThrow('inválido')
    await expect(R.reclamosAbiertosDeImpl('x')).rejects.toThrow('inválida')
  })
  it('un FED ajeno a la escuela no puede darlo por resuelto', async () => {
    estado.responder = l => (l.tabla === 'reclamos_conectividad' ? { data: { estado: 'enviado', fed_id: 'otro', notas: null, school: { fed_a_cargo: 'Beto Gómez' } } } : {})
    await expect(R.resolverReclamoImpl(yoFed, UID, null)).rejects.toThrow()
    expect(de('reclamos_conectividad', 'update')).toHaveLength(0)
  })
  it('quien lo registró sí puede resolverlo', async () => {
    estado.responder = l => (l.tabla === 'reclamos_conectividad' ? { data: { estado: 'enviado', fed_id: 'f1', notas: null, school: { fed_a_cargo: 'Beto Gómez' } } } : {})
    await R.resolverReclamoImpl(yoFed, UID, 'ya anda')
    expect(de('reclamos_conectividad', 'update')).toHaveLength(1)
  })
  it('el asunto debe seguir el formato de la guía', async () => {
    estado.responder = l => (l.tabla === 'establecimientos' ? { data: { id: UID, cue: 12345678 } } : {})
    await expect(R.registrarReclamoImpl(yoFed, { school_id: UID, tipo: 'otro', asunto: 'x' })).rejects.toThrow()
  })
})

describe('cronogramas', () => {
  it('rechaza ids inválidos y estados fuera de la lista', async () => {
    await expect(R.marcarCronogramaImpl(yoFed, 'x', 'realizado', '')).rejects.toThrow('inválido')
    await expect(R.avisarCronogramaImpl(yoFed, UID, 'cualquiera' as never)).rejects.toThrow('inválido')
  })
  it('sólo administración sincroniza a mano', async () => {
    await expect(R.sincronizarCronogramasAhoraImpl(yoCed)).rejects.toThrow('administración')
    await expect(R.sincronizarCronogramasAhoraImpl(yoFed)).rejects.toThrow('administración')
    expect(estado.llamadas).toHaveLength(0)
  })
})

describe('eventos', () => {
  const ev = { nombre: 'Jornada', fechas: ['2026-11-04'], hora_inicio: null, hora_fin: null, modalidad: 'Presencial', lugar: 'Sede', enlace: null, descripcion: null } as never
  it('sólo administración carga y elimina', async () => {
    await expect(E.guardarEvento(yoFed, ev)).rejects.toThrow('administración')
    await expect(E.guardarEvento(yoCed, ev)).rejects.toThrow('administración')
    await expect(E.eliminarEvento(yoCed, UID)).rejects.toThrow('administración')
    expect(estado.llamadas).toHaveLength(0)
  })
  it('exige nombre y fecha', async () => {
    await expect(E.guardarEvento(yoAdmin, { ...(ev as object), nombre: ' ' } as never)).rejects.toThrow('obligatorios')
    await expect(E.guardarEvento(yoAdmin, { ...(ev as object), fechas: [] } as never)).rejects.toThrow('obligatorios')
  })
  it('no permite más de 10 fechas ni fines de semana', async () => {
    const mucho = Array.from({ length: 11 }, (_, i) => `2026-11-${String(i + 2).padStart(2, '0')}`)
    await expect(E.guardarEvento(yoAdmin, { ...(ev as object), fechas: mucho } as never)).rejects.toThrow('10 fechas')
    await expect(E.guardarEvento(yoAdmin, { ...(ev as object), fechas: ['2026-11-07'] } as never)).rejects.toThrow('fin de semana')
  })
  it('un evento nuevo avisa al resto del equipo', async () => {
    estado.responder = l => (l.tabla === 'eventos_dte' ? { data: { id: UID } } : l.tabla === 'feds' ? { data: [{ id: 'f1' }, { id: 'c1' }] } : {})
    await expect(E.guardarEvento(yoAdmin, ev)).resolves.toBe(UID)
    expect(de('notificaciones', 'insert')).toHaveLength(1)
  })
  it('registrar participación ignora fechas que no son del evento', async () => {
    estado.responder = l => (l.tabla === 'eventos_dte' ? { data: { fechas: ['2026-11-04'], hora_inicio: null, hora_fin: null, nombre: 'J', modalidad: 'Virtual', lugar: null } } : l.tabla === 'agenda_items' ? { data: [] } : {})
    await expect(E.registrarParticipacion(yoFed, UID, ['2026-12-01'])).resolves.toBe(0)
    expect(de('agenda_items', 'insert')).toHaveLength(0)
  })
})
