import { beforeEach, describe, expect, it, vi } from 'vitest'

// Lo que corre solo de madrugada (lectura del consolidado y avisos), con una base falsa que anota qué se le pide.
type Op = { m: string, args: unknown[] }
type Llamada = { tabla: string, ops: Op[] }
type Respuesta = { data?: unknown, error?: { message: string } | null }
const estado = vi.hoisted(() => ({ responder: (_l: Llamada): Respuesta => ({}), llamadas: [] as Llamada[], csv: '' }))

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
vi.mock('@/lib/pve', () => ({ noLaborables: async () => new Set<string>() }))
vi.mock('@/lib/drive', () => ({ exportarHojaCsv: async () => estado.csv }))

import { avisarCronogramas } from '@/lib/cronogramas-avisos'
import { sincronizarCronogramas } from '@/lib/cronogramas-sync'
import { avisoNuevosCed, avisoNuevosFed, avisoRecordatorioCed, avisoRecordatorioFed, cuandoEmpieza, haceDias } from '@/lib/cronogramas'
import { hoyAR } from '@/lib/hora'

const tiene = (l: Llamada, m: string) => l.ops.some(o => o.m === m)
const op = (l: Llamada, m: string) => l.ops.find(o => o.m === m)?.args
beforeEach(() => { estado.llamadas = []; estado.responder = () => ({}) })

describe('avisos de cronogramas', () => {
  const personas = [{ id: 'f1', nombre_completo: 'Ana Pérez', rol: 'fed' }, { id: 'f2', nombre_completo: 'Luis Gómez', rol: 'fed' }, { id: 'c1', nombre_completo: 'Julio Machado', rol: 'coordinacion' }]
  const fila = (id: string, fed: string | null, inicio: string, fin: string) => ({ id, cue: 61000000 + Number(id.slice(1)), fecha_inicio: inicio, fecha_fin: fin, tipo: 'LAC_M', school: { nombre: 'ESCUELA DE EDUCACIÓN PRIMARIA N° 4', fed_a_cargo: fed } })
  const A = fila('A1', 'Ana Pérez', '2026-10-12', '2026-10-20'), B = fila('B2', null, '2026-10-12', '2026-10-20'), C = fila('C3', 'Ana Pérez', '2026-08-01', '2026-09-01'), D = fila('D4', 'Ana Pérez', '2026-10-09', '2026-10-09')

  function base(extra: Partial<Record<'pendientes' | 'recordar', unknown[]>> = {}) {
    estado.responder = l => {
      if (l.tabla === 'feds') return { data: personas }
      if (l.tabla === 'cronogramas' && tiene(l, 'select')) return { data: tiene(l, 'gt') ? (extra.recordar ?? []) : (extra.pendientes ?? []) }
      return {}
    }
  }
  const inserts = () => estado.llamadas.filter(l => l.tabla === 'notificaciones' && tiene(l, 'insert')).map(l => op(l, 'insert')![0] as { fed_id: string, tipo: string, detalle: string }[])
  const marcas = (columna: string) => estado.llamadas.filter(l => l.tabla === 'cronogramas' && tiene(l, 'update') && columna in (op(l, 'update')![0] as object)).flatMap(l => op(l, 'in')![1] as string[])

  it('avisa los nuevos por FED y al CED, y marca todos (también los que ya terminaron, sin avisarlos)', async () => {
    base({ pendientes: [A, B, C] })
    const r = await avisarCronogramas('2026-10-10') // sábado: sin recordatorio
    expect(r).toEqual({ nuevos: 2, recordados: 0, feds: 1, ced: 1 })
    const [avisos] = inserts()
    expect(avisos).toHaveLength(2)
    expect(avisos).toContainEqual({ fed_id: 'f1', tipo: 'cronograma', detalle: avisoNuevosFed([A]) })
    expect(avisos).toContainEqual({ fed_id: 'c1', tipo: 'cronograma', detalle: avisoNuevosCed(2, 1) })
    expect(marcas('avisado_at').sort()).toEqual(['A1', 'B2', 'C3'])
  })

  it('el día hábil anterior recuerda lo que empieza al siguiente', async () => {
    base({ recordar: [D] })
    const r = await avisarCronogramas('2026-10-08') // jueves, empieza el viernes
    expect(r).toEqual({ nuevos: 0, recordados: 1, feds: 1, ced: 1 })
    const [avisos] = inserts()
    expect(avisos).toContainEqual({ fed_id: 'f1', tipo: 'cronograma', detalle: avisoRecordatorioFed([D], cuandoEmpieza('2026-10-08', '2026-10-09')) })
    expect(avisos).toContainEqual({ fed_id: 'c1', tipo: 'cronograma', detalle: avisoRecordatorioCed(1, 0, cuandoEmpieza('2026-10-08', '2026-10-09')) })
    expect(marcas('recordado_at')).toEqual(['D4'])
  })

  it('en fin de semana no recuerda: ni siquiera consulta', async () => {
    base({ recordar: [D] })
    const r = await avisarCronogramas('2026-10-10')
    expect(r.recordados).toBe(0)
    expect(estado.llamadas.some(l => tiene(l, 'gt'))).toBe(false)
  })

  it('sin nada para avisar no manda notificaciones', async () => {
    base()
    expect(await avisarCronogramas('2026-10-08')).toEqual({ nuevos: 0, recordados: 0, feds: 0, ced: 0 })
    expect(inserts()).toHaveLength(0)
  })

  it('si falla la base, el error sale (la corrida de madrugada lo anota y reintenta)', async () => {
    estado.responder = l => (l.tabla === 'feds' ? { error: { message: 'sin conexión' } } : {})
    await expect(avisarCronogramas('2026-10-08')).rejects.toThrow('sin conexión')
  })
})

describe('lectura del consolidado', () => {
  const ENC = 'ESTADO,PREDIO,Region,Fecha de Inicio,Fecha de Fin,Instalador Responsable,Proveedor,Cues involucrados,Nombre de las escuelas,Semana en que fue informado,Tipo,Distrito,Nro cronograma o incidencia,Descripcion de incidencia,Observaciones de territorio,Tipo de establecimiento'
  const dmy = (iso: string) => `${Number(iso.slice(8, 10))}/${Number(iso.slice(5, 7))}/${iso.slice(0, 4)}`
  const fila = (o: Record<number, string>) => Array.from({ length: 16 }, (_, i) => o[i] ?? '').join(',')
  const hoy = hoyAR()
  const vigente = (cue: string, nro: string) => fila({ 3: dmy(hoy), 4: dmy(haceDias(hoy, -5)), 6: 'PBA', 7: cue, 10: 'LAC_M', 12: nro })
  const upserts = () => estado.llamadas.filter(l => l.tabla === 'cronogramas' && tiene(l, 'upsert')).map(l => op(l, 'upsert')![0] as Record<string, unknown>[])

  function responder(opts: { escuelas?: { id: string, cue: number }[], previas?: { clave: string, hash: string }[], quitadas?: unknown[] } = {}) {
    estado.responder = l => {
      if (l.tabla === 'establecimientos') return { data: opts.escuelas ?? [] }
      if (l.tabla === 'cronogramas' && tiene(l, 'select') && !tiene(l, 'update')) return { data: opts.previas ?? [] }
      if (l.tabla === 'cronogramas' && tiene(l, 'update')) return { data: opts.quitadas ?? [] }
      return {}
    }
  }

  it('carga lo nuevo y cuenta las escuelas que no están en la agenda', async () => {
    estado.csv = [ENC, vigente('61457700', '1'), vigente('61520100', '2')].join('\n')
    responder({ escuelas: [{ id: 'e1', cue: 61457700 }] })
    const r = await sincronizarCronogramas()
    expect(r).toMatchObject({ filas: 2, nuevas: 2, cambiadas: 0, sinEscuela: 1, quitadas: 0 })
    const filas = upserts().flat()
    expect(filas).toHaveLength(2)
    expect(filas.find(f => f.cue === 61457700)).toMatchObject({ school_id: 'e1', en_planilla: true })
    expect(filas.find(f => f.cue === 61520100)).toMatchObject({ school_id: null })
  })

  it('lo que no cambió conserva su fecha de actualización y lo que cambió la renueva', async () => {
    estado.csv = [ENC, vigente('61457700', '1')].join('\n')
    responder()
    await sincronizarCronogramas()
    const cargada = upserts().flat()[0] as { clave: string, hash: string }

    estado.llamadas = []
    responder({ previas: [{ clave: cargada.clave, hash: cargada.hash }] })
    expect(await sincronizarCronogramas()).toMatchObject({ nuevas: 0, cambiadas: 0 })
    expect(upserts().flat().every(f => !('actualizado_at' in f))).toBe(true)

    estado.llamadas = []
    responder({ previas: [{ clave: cargada.clave, hash: 'otra-huella' }] })
    expect(await sincronizarCronogramas()).toMatchObject({ nuevas: 0, cambiadas: 1 })
    expect(upserts().flat().every(f => 'actualizado_at' in f)).toBe(true)
  })

  it('lo que desaparece de la planilla se marca, no se borra', async () => {
    estado.csv = [ENC, vigente('61457700', '1')].join('\n')
    responder({ quitadas: [{ id: 'x' }, { id: 'y' }] })
    const r = await sincronizarCronogramas()
    expect(r.quitadas).toBe(2)
    const marca = estado.llamadas.find(l => l.tabla === 'cronogramas' && tiene(l, 'update'))!
    expect(op(marca, 'update')![0]).toEqual({ en_planilla: false })
    expect(estado.llamadas.some(l => tiene(l, 'delete'))).toBe(false)
  })

  it('una planilla sin cronogramas vigentes no toca nada', async () => {
    estado.csv = [ENC, fila({ 3: '1/1/2020', 4: '2/1/2020', 7: '61457700', 10: 'LAC' })].join('\n')
    responder()
    await expect(sincronizarCronogramas()).rejects.toThrow(/no tiene cronogramas vigentes/)
    expect(estado.llamadas).toHaveLength(0)
  })
})
