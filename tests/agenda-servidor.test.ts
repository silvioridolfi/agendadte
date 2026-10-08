import { beforeEach, describe, expect, it, vi } from 'vitest'

// Núcleo de la agenda: qué ve y qué toca cada rol, con la base simulada.
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

import * as A from '@/lib/servidor/agenda'

const mk = (id: string, rol: string, esAdmin = false) => ({ fed: { id, nombre_completo: id, rol }, userId: id, email: `${id}@x`, esAdmin, debeCambiar: false }) as never
const yoFed = mk('f1', 'fed'), yoCed = mk('c1', 'coordinacion'), yoAdmin = mk('a1', 'fed', true)
const de = (tabla: string, m: string) => estado.llamadas.filter(l => l.tabla === tabla && l.ops.some(o => o.m === m))
beforeEach(() => { estado.llamadas = []; estado.responder = () => ({}) })

describe('compañeros', () => {
  const feds = [{ id: 'f1', ddjj: [1], carpeta_fotos_url: 'u1' }, { id: 'f2', ddjj: [2], carpeta_fotos_url: 'u2' }]
  it('un FED ve los horarios y la carpeta sólo de sí mismo', async () => {
    estado.responder = () => ({ data: feds })
    const r = await A.getFeds(yoFed) as unknown as typeof feds
    expect(r[0].ddjj).toEqual([1])
    expect(r[1].ddjj).toEqual([]); expect(r[1].carpeta_fotos_url).toBeNull()
  })
  it('la coordinación y la administración ven todo', async () => {
    estado.responder = () => ({ data: feds })
    expect(((await A.getFeds(yoCed)) as unknown as typeof feds)[1].ddjj).toEqual([2])
    expect(((await A.getFeds(yoAdmin)) as unknown as typeof feds)[1].carpeta_fotos_url).toBe('u2')
  })
})

describe('agenda de otro', () => {
  it('un FED no puede pedir la agenda de un compañero', async () => {
    await expect(A.getFedItems(yoFed, 'f2', '2026-09-01', '2026-09-30')).rejects.toThrow('propia agenda')
    expect(estado.llamadas).toHaveLength(0)
  })
  it('sí la propia, y la coordinación la de cualquiera', async () => {
    await expect(A.getFedItems(yoFed, 'f1', '2026-09-01', '2026-09-30')).resolves.toEqual([])
    await expect(A.getFedItems(yoCed, 'f2', '2026-09-01', '2026-09-30')).resolves.toEqual([])
  })
})

describe('encuentros y actividad', () => {
  it('un FED sólo ve los encuentros propios', async () => {
    estado.responder = () => ({ data: [{ id: 'e1', fed_id: 'f1', item: null }, { id: 'e2', fed_id: 'f2', item: null }] })
    const r = await A.getEncuentros(yoFed, '2026-09-01', '2026-09-30')
    expect(r.every(e => e.fed_id === 'f1')).toBe(true)
  })
  it('la actividad del equipo es sólo de CED y administración', async () => {
    await expect(A.getActividadEquipo(yoFed)).resolves.toEqual([])
    expect(estado.llamadas).toHaveLength(0)
  })
})

describe('clubes', () => {
  it('sólo quien lleva el club (o la administración) lo finaliza', async () => {
    estado.responder = l => (l.tabla === 'clubes' ? { data: { fed_id: 'otro' } } : {})
    await expect(A.setClubCierre(yoFed, 'c', '2026-10-01')).rejects.toThrow('Sólo quien lleva el club')
    expect(de('clubes', 'update')).toHaveLength(0)
    await expect(A.setClubCierre(yoAdmin, 'c', '2026-10-01')).resolves.toBeUndefined()
    expect(de('clubes', 'update')).toHaveLength(1)
  })
  it('rechaza fechas con formato inválido', async () => {
    estado.responder = l => (l.tabla === 'clubes' ? { data: { fed_id: 'f1' } } : {})
    await expect(A.setClubCierre(yoFed, 'c', '1/10')).rejects.toThrow('Fecha inválida')
  })
})

describe('historial y acciones propias', () => {
  it('un FED ajeno a la acción no ve su historial', async () => {
    estado.responder = l => (l.tabla === 'agenda_items' ? { data: { fed_id: 'f2' } } : { data: [] })
    await expect(A.getHistorial(yoFed, 'i1')).rejects.toThrow('No podés ver el historial')
  })
  it('la coordinación sí', async () => {
    estado.responder = () => ({ data: [] })
    await expect(A.getHistorial(yoCed, 'i1')).resolves.toEqual([])
  })
  it('no se puede borrar una acción ajena ni usar un estado inválido', async () => {
    await expect(A.deleteItemImpl('i1', 'f1')).rejects.toThrow('no es tuya')
    await expect(A.setItemStatusImpl('i1', 'f1', 'inventado' as never)).rejects.toThrow('Estado inválido')
  })
})
