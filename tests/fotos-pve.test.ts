import { beforeEach, describe, expect, it, vi } from 'vitest'

// PVE y fotos: quién puede ver, marcar y devolver, con la base simulada.
type Op = { m: string, args: unknown[] }
type Llamada = { tabla: string, ops: Op[] }
type Respuesta = { data?: unknown, error?: { message: string } | null }
const estado = vi.hoisted(() => ({
  responder: (_l: Llamada): Respuesta => ({}), llamadas: [] as Llamada[], usuario: null as unknown,
}))

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
vi.mock('@/lib/sesion', async () => {
  const real = await vi.importActual<typeof import('@/lib/sesion')>('@/lib/sesion').catch(() => ({}) as Record<string, unknown>)
  return { ...real, requerirUsuario: async () => estado.usuario }
})

import * as M from '@/lib/servidor/fotos-pve'

const yoFed = { fed: { id: 'f1', nombre_completo: 'Ana Pérez', rol: 'fed' }, userId: 'u1', email: 'a@x', esAdmin: false, debeCambiar: false }
const yoCed = { ...yoFed, fed: { ...yoFed.fed, id: 'c1', rol: 'coordinacion' } }
const de = (tabla: string, m: string) => estado.llamadas.filter(l => l.tabla === tabla && l.ops.some(o => o.m === m))
beforeEach(() => { estado.llamadas = []; estado.responder = () => ({}); estado.usuario = yoFed })

describe('guardarCarpetaFotos', () => {
  it('rechaza enlaces que no son de Drive', async () => {
    await expect(M.guardarCarpetaFotos(yoFed as never, 'https://otro.com/x')).rejects.toThrow('Drive')
    expect(estado.llamadas).toHaveLength(0)
  })
  it('con el campo vacío desvincula la carpeta propia', async () => {
    await M.guardarCarpetaFotos(yoFed as never, '  ')
    const u = de('feds', 'update')[0]
    expect(u.ops.find(o => o.m === 'eq')?.args).toEqual(['id', 'f1'])
  })
})

describe('PVE del equipo: sólo coordinación o administración', () => {
  it('un FED no puede ver, marcar ni devolver', async () => {
    await expect(M.pveEquipo('2026-09-01')).rejects.toThrow('coordinación')
    await expect(M.marcarPveEnviadas('2026-09-01')).rejects.toThrow('coordinación')
    await expect(M.devolverPve('f2', '2026-09-01', 'falta firma')).rejects.toThrow('coordinación')
    expect(estado.llamadas).toHaveLength(0)
  })
  it('la coordinación devuelve con motivo y avisa al FED', async () => {
    estado.usuario = yoCed
    estado.responder = l => (l.tabla === 'pve' ? { data: [{ fed_id: 'f2' }] } : {})
    await M.devolverPve('f2', '2026-09-01', '  falta firma ')
    expect(de('notificaciones', 'insert')).toHaveLength(1)
    expect(de('pve_historial', 'insert')).toHaveLength(1)
  })
  it('exige motivo', async () => {
    estado.usuario = yoCed
    await expect(M.devolverPve('f2', '2026-09-01', '  ')).rejects.toThrow('motivo')
  })
  it('un admin que es FED también puede', async () => {
    estado.usuario = { ...yoFed, esAdmin: true }
    estado.responder = () => ({ data: [] })
    await expect(M.marcarPveEnviadas('2026-09-01')).resolves.toBe(0)
  })
})

describe('abrirCarpetaPve', () => {
  it('sólo los FED entregan', async () => {
    await expect(M.abrirCarpetaPve(yoCed as never, '2026-09-01')).rejects.toThrow('FED')
  })
})

describe('conteoFotos', () => {
  const filas = [{ fed_id: 'f1', fecha: '2026-09-01', item_id: 'i1' }, { fed_id: 'f1', fecha: '2026-09-01', item_id: null }]
  it('un FED cuenta sólo las propias', async () => {
    estado.responder = () => ({ data: filas })
    const r = await M.conteoFotos(yoFed as never)
    expect(r.dias['f1|2026-09-01']).toBe(2)
    expect(r.items.i1).toBe(1)
    expect(r.sueltas['f1|2026-09-01']).toBe(1)
    expect(estado.llamadas[0].ops.some(o => o.m === 'eq' && o.args[1] === 'f1')).toBe(true)
  })
  it('la coordinación cuenta todo el equipo', async () => {
    estado.responder = () => ({ data: [] })
    await M.conteoFotos(yoCed as never)
    expect(estado.llamadas[0].ops.some(o => o.m === 'eq')).toBe(false)
  })
})
