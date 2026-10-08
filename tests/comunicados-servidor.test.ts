import { beforeEach, describe, expect, it, vi } from 'vitest'

// Reglas de rol y de lectura de los comunicados, con una base falsa que anota qué se le pide.
type Op = { m: string, args: unknown[] }
type Llamada = { tabla: string, ops: Op[] }
type Respuesta = { data?: unknown, error?: { message: string } | null }
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

import * as comunicados from '@/lib/servidor/comunicados'
import type { Usuario } from '@/lib/sesion'
import type { EntradaComunicado } from '@/lib/comunicados'

const usuario = (id: string, rol: 'fed' | 'coordinacion', esAdmin = false) => ({ fed: { id, nombre_completo: id, rol }, esAdmin, userId: id, email: `${id}@abc.gob.ar`, debeCambiar: false }) as unknown as Usuario
const fed = usuario('f1', 'fed'), otroFed = usuario('f2', 'fed'), ced = usuario('c1', 'coordinacion'), admin = usuario('a1', 'fed', true)
const MAÑANA = '2099-01-01', AYER = '2000-01-01'
const com = (o: Record<string, unknown>) => ({ id: 'x', titulo: 'T', texto: 'M', nivel: 'informativo', fed_ids: null, autor_id: 'c1', vence_el: null, retirado: false, created_at: '2026-10-08T12:00:00Z', editado_at: null, ...o })
const entrada: EntradaComunicado = { titulo: 'Reunión', texto: 'El jueves', nivel: 'informativo', fedIds: null, venceEl: null }
const tiene = (l: Llamada, m: string) => l.ops.some(o => o.m === m)
const de = (tabla: string, m: string) => estado.llamadas.filter(l => l.tabla === tabla && tiene(l, m))
beforeEach(() => { estado.llamadas = []; estado.responder = () => ({}) })

describe('comunicados: lo que ve cada FED', () => {
  const lista = [
    com({ id: 'a', titulo: 'Para todos', created_at: '2026-10-01T10:00:00Z' }),
    com({ id: 'b', titulo: 'Solo f2', fed_ids: ['f2'] }),
    com({ id: 'c', titulo: 'Importante', nivel: 'importante', fed_ids: ['f1'], created_at: '2026-09-01T10:00:00Z' }),
    com({ id: 'd', titulo: 'Vencido', vence_el: AYER }),
    com({ id: 'e', titulo: 'Ya leído' }),
  ]
  function responder(leidos: string[] = ['e']) {
    estado.responder = l => {
      if (l.tabla === 'comunicados') return { data: lista }
      if (l.tabla === 'comunicado_lecturas') return { data: leidos.map(comunicado_id => ({ comunicado_id })) }
      if (l.tabla === 'feds') return { data: [{ id: 'c1', nombre_completo: 'Julio Machado' }] }
      return {}
    }
  }

  it('recibe los de todos y los suyos, sin vencidos, de otros ni leídos; los importantes primero', async () => {
    responder()
    const r = await comunicados.comunicadosPendientes(fed)
    expect(r.map(x => x.id)).toEqual(['c', 'a'])
    expect(r[0].autor).toBe('Julio Machado')
  })
  it('la coordinación no recibe los que van a todos los FED', async () => {
    responder([])
    expect(await comunicados.comunicadosPendientes(ced)).toEqual([])
  })

  it('marca como leído lo que le llega y no pisa la primera lectura', async () => {
    estado.responder = l => (l.tabla === 'comunicados' ? { data: com({ id: 'a' }) } : {})
    await comunicados.marcarLeido(fed, 'a')
    const [up] = de('comunicado_lecturas', 'upsert')
    expect(up.ops.find(o => o.m === 'upsert')!.args).toEqual([{ comunicado_id: 'a', fed_id: 'f1' }, { onConflict: 'comunicado_id,fed_id', ignoreDuplicates: true }])
  })
  it('no marca lo retirado ni lo dirigido a otro', async () => {
    estado.responder = l => (l.tabla === 'comunicados' ? { data: com({ retirado: true }) } : {})
    await expect(comunicados.marcarLeido(fed, 'x')).rejects.toThrow(/no está disponible/)
    estado.responder = l => (l.tabla === 'comunicados' ? { data: com({ fed_ids: ['f2'] }) } : {})
    await expect(comunicados.marcarLeido(fed, 'x')).rejects.toThrow(/no está disponible/)
    expect(de('comunicado_lecturas', 'upsert')).toHaveLength(0)
  })
})

describe('comunicados: quién gestiona', () => {
  it('un FED no gestiona nada', async () => {
    await expect(comunicados.comunicadosGestion(fed)).rejects.toThrow(/Sólo el CED/)
    await expect(comunicados.crear(fed, entrada)).rejects.toThrow(/Sólo el CED/)
    await expect(comunicados.editar(fed, 'x', entrada)).rejects.toThrow(/Sólo el CED/)
    await expect(comunicados.retirar(fed, 'x')).rejects.toThrow(/Sólo el CED/)
    await expect(comunicados.eliminar(fed, 'x')).rejects.toThrow(/Sólo el CED/)
    expect(estado.llamadas).toHaveLength(0)
  })

  it('la coordinación y la administración crean, y queda en la auditoría', async () => {
    for (const quien of [ced, admin]) {
      estado.llamadas = []
      estado.responder = l => (l.tabla === 'comunicados' ? { data: { id: 'nuevo' } } : {})
      expect(await comunicados.crear(quien, entrada)).toBe('nuevo')
      expect(de('comunicados', 'insert')[0].ops.find(o => o.m === 'insert')!.args[0]).toMatchObject({ titulo: 'Reunión', fed_ids: null, autor_id: quien.fed.id })
      expect(de('auditoria', 'insert')).toHaveLength(1)
    }
  })
  it('no crea con datos inválidos', async () => {
    await expect(comunicados.crear(ced, { ...entrada, titulo: ' ' })).rejects.toThrow(/título/)
    await expect(comunicados.crear(ced, { ...entrada, fedIds: [] })).rejects.toThrow(/al menos un FED/)
    expect(de('comunicados', 'insert')).toHaveLength(0)
  })
  it('a los FED elegidos, solo si existen', async () => {
    estado.responder = l => (l.tabla === 'feds' ? { data: [] } : {})
    await expect(comunicados.crear(ced, { ...entrada, fedIds: ['no-existe'] })).rejects.toThrow(/al menos un FED/)
  })

  it('editar el mensaje pide leerlo de nuevo; editar solo los destinatarios, no', async () => {
    estado.responder = l => (l.tabla === 'comunicados' && tiene(l, 'maybeSingle') ? { data: { titulo: 'Reunión', texto: 'El jueves', nivel: 'informativo' } } : {})
    await comunicados.editar(ced, 'x', { ...entrada, texto: 'El viernes' })
    expect(de('comunicado_lecturas', 'delete')).toHaveLength(1)
    estado.llamadas = []
    await comunicados.editar(ced, 'x', { ...entrada, venceEl: MAÑANA })
    expect(de('comunicado_lecturas', 'delete')).toHaveLength(0)
  })

  it('un comunicado vigente primero se retira; recién después se elimina', async () => {
    estado.responder = l => (l.tabla === 'comunicados' ? { data: com({}) } : {})
    await expect(comunicados.eliminar(ced, 'x')).rejects.toThrow(/Primero hay que retirarlo/)
    expect(de('comunicados', 'delete')).toHaveLength(0)
    estado.responder = l => (l.tabla === 'comunicados' ? { data: com({ retirado: true }) } : {})
    await comunicados.eliminar(ced, 'x')
    expect(de('comunicados', 'delete')).toHaveLength(1)
    expect(de('auditoria', 'insert')).toHaveLength(1)
  })
  it('retirar solo lo oculta', async () => {
    await comunicados.retirar(admin, 'x')
    expect(de('comunicados', 'update')[0].ops.find(o => o.m === 'update')!.args[0]).toEqual({ retirado: true })
  })
})
