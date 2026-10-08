import { beforeEach, describe, expect, it, vi } from 'vitest'

// Escuelas, mis escuelas, edición y jefaturas: quién ve y quién edita, con la base simulada.
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

import * as S from '@/lib/servidor/escuelas'

const UID = '11111111-1111-4111-8111-111111111111'
const yoFed = { fed: { id: 'f1', nombre_completo: 'Ana Pérez', rol: 'fed' }, userId: 'u1', email: 'a@x', esAdmin: false, debeCambiar: false } as never
const yoCed = { fed: { id: 'c1', nombre_completo: 'Julio', rol: 'coordinacion' }, userId: 'u2', email: 'c@x', esAdmin: false, debeCambiar: false } as never
const yoAdmin = { fed: { id: 'a1', nombre_completo: 'Silvio', rol: 'fed' }, userId: 'u3', email: 's@x', esAdmin: true, debeCambiar: false } as never
const de = (tabla: string, m: string) => estado.llamadas.filter(l => l.tabla === tabla && l.ops.some(o => o.m === m))
beforeEach(() => { estado.llamadas = []; estado.responder = () => ({}) })

describe('ids inválidos', () => {
  it('se rechazan antes de consultar', async () => {
    await expect(S.getFichaEscuelaImpl(yoFed, 'x')).rejects.toThrow('inválida')
    await expect(S.getConectividadEscuelaImpl('x')).rejects.toThrow('inválida')
    await expect(S.getExtrasEscuelaImpl(yoFed, 'x')).rejects.toThrow('inválida')
    await expect(S.guardarEscuelaImpl(yoFed, 'x', {})).rejects.toThrow('inválida')
    await expect(S.getJefaturaImpl(yoCed, 'x')).rejects.toThrow('inválida')
    expect(estado.llamadas).toHaveLength(0)
  })
})

describe('extras de la escuela (reclamos y cronogramas)', () => {
  it('un FED que no está a cargo no los ve', async () => {
    estado.responder = l => (l.tabla === 'establecimientos' ? { data: { fed_a_cargo: 'Beto Gómez' } } : {})
    await expect(S.getExtrasEscuelaImpl(yoFed, UID)).rejects.toThrow('FED a cargo')
  })
  it('el FED a cargo sí, y también el CED', async () => {
    estado.responder = l => (l.tabla === 'establecimientos' ? { data: { fed_a_cargo: 'Ana Pérez' } } : { data: [] })
    await expect(S.getExtrasEscuelaImpl(yoFed, UID)).resolves.toBeTruthy()
    estado.responder = l => (l.tabla === 'establecimientos' ? { data: { fed_a_cargo: 'Beto Gómez' } } : { data: [] })
    await expect(S.getExtrasEscuelaImpl(yoCed, UID)).resolves.toBeTruthy()
  })
})

describe('edición de la ficha', () => {
  it('un FED que no está a cargo no puede editar ni tocar contactos', async () => {
    estado.responder = l => (l.tabla === 'establecimientos' ? { data: { id: UID, cue: 1, fed_a_cargo: 'Beto Gómez' } } : {})
    await expect(S.guardarEscuelaImpl(yoFed, UID, { direccion: 'x' })).rejects.toThrow('pueden editarla')
    await expect(S.borrarContactoImpl(yoFed, UID, UID)).rejects.toThrow('pueden editarla')
    expect(de('establecimientos', 'update')).toHaveLength(0)
    expect(de('contactos', 'delete')).toHaveLength(0)
  })
  it('administración y CED pasan el control de nivel', async () => {
    estado.responder = l => (l.tabla === 'establecimientos' ? { data: { id: UID, cue: 1, fed_a_cargo: 'Beto Gómez' } } : { data: [] })
    await expect(S.escuelaEditable(yoCed, UID)).resolves.toBeTruthy()
    await expect(S.escuelaEditable(yoAdmin, UID)).resolves.toBeTruthy()
  })
})

describe('jefaturas', () => {
  it('sólo el CED o la administración las editan', async () => {
    await expect(S.guardarJefaturaImpl(yoFed, UID, { nombre: 'x' })).rejects.toThrow('CED o la administración')
    expect(estado.llamadas).toHaveLength(0)
  })
})
