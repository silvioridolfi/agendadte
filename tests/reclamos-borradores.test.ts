import { beforeEach, describe, expect, it, vi } from 'vitest'

// Borradores de reclamos: cada uno ve y toca solo los suyos; al marcarlos como enviados pasan al registro y avisan al CED.
type Op = { m: string, args: unknown[] }
type Llamada = { tabla: string, ops: Op[] }
type Respuesta = { data?: unknown, error?: { message: string } | null, count?: number }
const estado = vi.hoisted(() => ({ responder: (_l: Llamada): Respuesta => ({}), llamadas: [] as Llamada[] }))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase-server', () => ({
  supabaseServer: () => ({
    from: (tabla: string) => {
      const l: Llamada = { tabla, ops: [] }
      estado.llamadas.push(l)
      const cadena: unknown = new Proxy({}, {
        get: (_, m: string) => {
          if (m === 'then') return (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(estado.responder(l)).then(r => ({ data: r.data ?? null, error: r.error ?? null, count: r.count ?? null })).then(ok, ko)
          return (...args: unknown[]) => { l.ops.push({ m, args }); return cadena }
        },
      })
      return cadena
    },
  }),
}))

import * as R from '@/lib/servidor/reclamos-cronogramas'
import { hoyAR } from '@/lib/hora'

const UID = '11111111-1111-4111-8111-111111111111'
const yoFed = { fed: { id: 'f1', nombre_completo: 'Ana Pérez', rol: 'fed' }, userId: 'u1', email: 'a@x', esAdmin: false, debeCambiar: false } as never
const ASUNTO = '06-01-091020260800 - CUE 61139000 - Sin Conectividad'
const entrada = { school_id: UID, tipo: 'sin_conectividad', asunto: ASUNTO, para: 'reclamos@x.gob.ar', cuerpo: 'Hola Julio,', adjuntos: [{ texto: 'Checklist USAP completo', enlace: 'https://docs.google.com/spreadsheets/d/x' }] }
const de = (tabla: string, m: string) => estado.llamadas.filter(l => l.tabla === tabla && l.ops.some(o => o.m === m))
const arg = (l: Llamada, m: string) => l.ops.find(o => o.m === m)?.args
beforeEach(() => { estado.llamadas = []; estado.responder = () => ({}) })

describe('guardar borrador', () => {
  it('valida el establecimiento, el tipo, el asunto, el mensaje y los adjuntos', async () => {
    await expect(R.guardarBorradorImpl(yoFed, { ...entrada, school_id: 'x' })).rejects.toThrow('inválido')
    await expect(R.guardarBorradorImpl(yoFed, { ...entrada, tipo: 'inventado' })).rejects.toThrow('Tipo')
    await expect(R.guardarBorradorImpl(yoFed, { ...entrada, cuerpo: '  ' })).rejects.toThrow('mensaje')
    await expect(R.guardarBorradorImpl(yoFed, { ...entrada, adjuntos: [{ texto: 'x', enlace: 'https://malo.com/x' }] })).rejects.toThrow('adjuntos')
    expect(estado.llamadas).toHaveLength(0)
    estado.responder = l => (l.tabla === 'establecimientos' ? { data: { id: UID, cue: 61139000, nombre: 'JARDÍN 909' } } : {})
    await expect(R.guardarBorradorImpl(yoFed, { ...entrada, asunto: '06-01-091020260800 - CUE 99999999 - Sin Conectividad' })).rejects.toThrow('formato')
  })
  it('guarda a nombre de quien lo arma, sin tocar el registro ni avisar a nadie', async () => {
    estado.responder = l => (l.tabla === 'establecimientos' ? { data: { id: UID, cue: 61139000, nombre: 'JARDÍN 909' } } : l.tabla === 'reclamos_borradores' && l.ops.some(o => o.m === 'insert') ? { data: { id: 'b1' } } : {})
    await expect(R.guardarBorradorImpl(yoFed, entrada)).resolves.toBe('b1')
    const ins = de('reclamos_borradores', 'insert')[0]
    expect((arg(ins, 'insert')![0] as { fed_id: string }).fed_id).toBe('f1')
    expect(de('reclamos_conectividad', 'insert')).toHaveLength(0)
    expect(de('notificaciones', 'insert')).toHaveLength(0)
  })
  it('un mismo asunto no se guarda dos veces: se actualiza el mensaje', async () => {
    estado.responder = l => (l.tabla === 'establecimientos' ? { data: { id: UID, cue: 61139000, nombre: 'J' } } : l.tabla === 'reclamos_borradores' ? { data: { id: 'ya' } } : {})
    await expect(R.guardarBorradorImpl(yoFed, { ...entrada, cuerpo: 'Hola Julio,\n\nTe paso un reclamo.' })).resolves.toBe('ya')
    expect(de('reclamos_borradores', 'insert')).toHaveLength(0)
    const up = de('reclamos_borradores', 'update')[0]
    expect((arg(up, 'update')![0] as { cuerpo: string }).cuerpo).toBe('Hola Julio,\n\nTe paso un reclamo.')
    expect(up.ops.filter(o => o.m === 'eq').map(o => o.args)).toContainEqual(['fed_id', 'f1'])
  })
  it('tiene un tope de borradores', async () => {
    estado.responder = l => (l.tabla === 'establecimientos' ? { data: { id: UID, cue: 61139000, nombre: 'J' } } : { data: null, count: 30 })
    await expect(R.guardarBorradorImpl(yoFed, entrada)).rejects.toThrow('borradores')
  })
})

describe('listar y eliminar: solo los propios', () => {
  it('lista únicamente los del que pide', async () => {
    estado.responder = () => ({ data: [] })
    await R.getBorradoresImpl(yoFed)
    expect(arg(estado.llamadas[0], 'eq')).toEqual(['fed_id', 'f1'])
  })
  it('eliminar filtra por id y por dueño, y falla si no es suyo', async () => {
    await expect(R.eliminarBorradorImpl(yoFed, 'x')).rejects.toThrow('inválido')
    await expect(R.eliminarBorradorImpl(yoFed, UID)).rejects.toThrow('No se encontró')
    const eqs = estado.llamadas[0].ops.filter(o => o.m === 'eq').map(o => o.args)
    expect(eqs).toContainEqual(['fed_id', 'f1'])
    estado.responder = () => ({ data: [{ id: UID }] })
    await expect(R.eliminarBorradorImpl(yoFed, UID)).resolves.toBeUndefined()
  })
})

describe('marcar como enviado', () => {
  const borrador = { id: UID, school_id: UID, tipo: 'sin_conectividad', asunto: ASUNTO }
  const respuestas = (l: Llamada): Respuesta => {
    if (l.tabla === 'reclamos_borradores') return l.ops.some(o => o.m === 'select') && !l.ops.some(o => o.m === 'delete') ? { data: borrador } : {}
    if (l.tabla === 'establecimientos') return { data: { id: UID, cue: 61139000, plan_enlace: 'PNCE', subplan_enlace: null, plan_piso_tecnologico: null } }
    if (l.tabla === 'reclamos_conectividad') return l.ops.some(o => o.m === 'insert') ? { data: { id: 'r1' } } : { data: null }
    if (l.tabla === 'feds') return { data: [{ id: 'c1' }] }
    return {}
  }
  it('rechaza una fecha futura o mal escrita', async () => {
    await expect(R.enviarBorradorImpl(yoFed, UID, '2999-01-01')).rejects.toThrow('futura')
    await expect(R.enviarBorradorImpl(yoFed, UID, 'ayer')).rejects.toThrow('futura')
    expect(estado.llamadas).toHaveLength(0)
  })
  it('no toca el borrador de otro', async () => {
    estado.responder = () => ({ data: null })
    await expect(R.enviarBorradorImpl(yoFed, UID, null)).rejects.toThrow('No se encontró')
    expect(estado.llamadas[0].ops.filter(o => o.m === 'eq').map(o => o.args)).toContainEqual(['fed_id', 'f1'])
    expect(de('reclamos_conectividad', 'insert')).toHaveLength(0)
  })
  it('lo registra con la fecha elegida, avisa al CED y borra el borrador', async () => {
    estado.responder = respuestas
    await expect(R.enviarBorradorImpl(yoFed, UID, '2026-10-01')).resolves.toBe('r1')
    const row = arg(de('reclamos_conectividad', 'insert')[0], 'insert')![0] as { asunto: string, enviado_at: string, fed_id: string }
    expect(row.asunto).toBe(ASUNTO); expect(row.fed_id).toBe('f1'); expect(row.enviado_at).toBe('2026-10-01T12:00:00-03:00')
    expect(de('notificaciones', 'insert')).toHaveLength(1)
    expect(de('reclamos_borradores', 'delete')).toHaveLength(1)
  })
  it('sin fecha o con la de hoy se registra con la hora actual', async () => {
    estado.responder = respuestas
    await R.enviarBorradorImpl(yoFed, UID, hoyAR())
    expect('enviado_at' in (arg(de('reclamos_conectividad', 'insert')[0], 'insert')![0] as object)).toBe(false)
  })
})
