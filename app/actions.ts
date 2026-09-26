'use server'

import { supabaseServer } from '@/lib/supabase-server'
import { ACCIONES, CON_ENCUENTRO, ESTADOS, type AgendaItem, type AgendaItemInput, type Encuentro, type EncuentroInput, type Fed, type Feriado, type School, type Club, MODALIDADES, TIPOS_JORNADA, CUE_DTE, esTrayecto } from '@/lib/agenda'

// En producción Next oculta el mensaje de los errores lanzados en server actions (React #441),
// así que se devuelven como valor y el cliente los vuelve a lanzar con el mensaje real.
export type Result<T> = { ok: true; data: T } | { ok: false; error: string }
async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try { return { ok: true, data: await fn() } } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) } }
}

const SCHOOL_COLS = 'id, cue, nombre, distrito, ciudad'

async function getFedsImpl(): Promise<Fed[]> {
  const { data, error } = await supabaseServer().from('feds').select('id, nombre_completo, distritos_a_cargo, carga_horaria, ddjj').order('nombre_completo')
  if (error) throw new Error(error.message)
  return data ?? []
}

async function searchSchoolsImpl(query: string): Promise<School[]> {
  const q = query.trim()
  if (q.length < 2) return []
  // Sin tildes, todas las palabras (nombre/ciudad) o prefijo de CUE: ver search_establecimientos en supabase/migrations.
  const { data, error } = await supabaseServer().rpc('search_establecimientos', { q, max_results: 15 })
  if (error) throw new Error(error.message)
  return data ?? []
}

// PostgREST devuelve como máximo 1000 filas por consulta: se pide por páginas (la vista anual supera ese límite).
const PAGE = 1000
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null, error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; ; i += PAGE) {
    const { data, error } = await page(i, i + PAGE - 1)
    if (error) throw new Error(error.message)
    out.push(...((data ?? []) as T[]))
    if (!data || data.length < PAGE) return out
  }
}

const ITEM_COLS = `*, school:establecimientos(${SCHOOL_COLS}), encuentros:agenda_encuentros(*)`

async function getFedItemsImpl(fedId: string, from: string, to: string): Promise<AgendaItem[]> {
  return fetchAll<AgendaItem>((a, b) => supabaseServer().from('agenda_items').select(ITEM_COLS).eq('fed_id', fedId)
    .gte('fecha', from).lte('fecha', to).order('fecha').order('hora_inicio', { nullsFirst: true }).order('id').range(a, b))
}

async function getAllItemsImpl(from: string, to: string): Promise<AgendaItem[]> {
  return fetchAll<AgendaItem>((a, b) => supabaseServer().from('agenda_items').select(ITEM_COLS)
    .gte('fecha', from).lte('fecha', to).order('fecha').order('hora_inicio', { nullsFirst: true }).order('id').range(a, b))
}

// Todos los encuentros del período, estén o no vinculados a una acción (para las métricas de participación).
async function getEncuentrosImpl(from: string, to: string): Promise<Encuentro[]> {
  return fetchAll<Encuentro>((a, b) => supabaseServer().from('agenda_encuentros').select(`*, school:establecimientos(${SCHOOL_COLS})`)
    .gte('fecha', from).lte('fecha', to).order('fecha').order('id').range(a, b))
}

const opt = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null)
const num = (v: number | null | undefined) => (v == null || Number.isNaN(v) ? null : Math.max(0, Math.round(v)))

function clean(input: AgendaItemInput) {
  if (!input.fed_id || !/^\d{4}-\d{2}-\d{2}$/.test(input.fecha)) throw new Error('FED y fecha son obligatorios')
  if (!ACCIONES.includes(input.accion) || !ESTADOS.includes(input.estado)) throw new Error('Acción o estado inválido')
  const { encuentro: _encuentro, ...row } = input
  return {
    ...row, school_id: opt(input.school_id), hora_inicio: opt(input.hora_inicio), hora_fin: opt(input.hora_fin), sub_accion: opt(input.sub_accion),
    detalle: opt(input.detalle), cantidad: num(input.cantidad), lugar: opt(input.lugar),
  }
}

function cleanEncuentro(e: EncuentroInput): EncuentroInput | null {
  const out: EncuentroInput = {
    id: e.id,
    propuesta: opt(e.propuesta), encuentro_n: num(e.encuentro_n) || null, destinatarios: opt(e.destinatarios),
    modalidad: e.modalidad && MODALIDADES.includes(e.modalidad) ? e.modalidad : null, inscriptos: num(e.inscriptos), asistentes: num(e.asistentes),
    tipo_jornada: e.tipo_jornada && TIPOS_JORNADA.includes(e.tipo_jornada) ? e.tipo_jornada : null, descripcion: opt(e.descripcion),
  }
  return out.propuesta || out.encuentro_n || out.destinatarios || out.inscriptos != null || out.asistentes != null || out.tipo_jornada || out.descripcion ? out : null
}

async function saveItemImpl(input: AgendaItemInput, id?: string): Promise<void> {
  const row = clean(input)
  const db = supabaseServer()
  // Paro: se registra en el lugar de trabajo (DTE). Licencia: sin escuela ni lugar.
  if (row.accion === 'PARO') {
    const { data } = await db.from('establecimientos').select('id').eq('cue', CUE_DTE).limit(1).maybeSingle()
    Object.assign(row, { school_id: data?.id ?? null, lugar: data ? null : 'Dirección de Tecnología Educativa', sub_accion: null })
  }
  if (row.accion === 'LICENCIA') Object.assign(row, { school_id: null, lugar: null })
  // Al editar, el item debe pertenecer al FED que lo edita.
  const res = id ? await db.from('agenda_items').update(row).eq('id', id).eq('fed_id', row.fed_id).select('id').single()
    : await db.from('agenda_items').insert(row).select('id').single()
  if (res.error) throw new Error(res.error.message)
  const itemId = res.data.id as string

  // Encuentro: se edita el que se mostró en el formulario (puede ser uno importado) o se crea uno nuevo.
  // Si la acción deja de ser club/taller/prácticas, sólo se borra el encuentro creado desde la app; los importados se conservan.
  const esClub = esTrayecto(row.accion)
  const enc = CON_ENCUENTRO.includes(row.accion) && input.encuentro ? (cleanEncuentro(input.encuentro) ?? (esClub ? { propuesta: null, encuentro_n: null, modalidad: null, destinatarios: null, inscriptos: null, asistentes: null } : null)) : null
  const encId = input.encuentro?.id
  if (enc) {
    const clubId = esClub ? await upsertClub(input, row) : null
    const encRow = { ...enc, id: undefined, agenda_item_id: itemId, fed_id: row.fed_id, school_id: row.school_id, lugar: row.lugar, fecha: row.fecha, tipo: row.accion, club_id: clubId, es_cierre: esClub && !!input.encuentro?.es_cierre }
    const { error } = encId ? await db.from('agenda_encuentros').update(encRow).eq('id', encId).eq('agenda_item_id', itemId) : await db.from('agenda_encuentros').insert(encRow)
    if (error) throw new Error(error.message)
  } else if (id) {
    const { error } = await db.from('agenda_encuentros').delete().eq('agenda_item_id', itemId).eq('origen', 'app')
    if (error) throw new Error(error.message)
  }
}

// Club del encuentro: crea uno nuevo (inicia en esta fecha) o actualiza el elegido; marcar cierre lo finaliza.
async function upsertClub(input: AgendaItemInput, row: ReturnType<typeof clean>): Promise<string | null> {
  const e = input.encuentro!
  const db = supabaseServer()
  const previstos = num(e.encuentros_previstos) || null
  if (e.nuevo_club || !e.club_id) {
    if (!e.nuevo_club) return null
    const { data, error } = await db.from('clubes').insert({
      fed_id: row.fed_id, school_id: row.school_id, lugar: row.lugar, grupo: opt(e.grupo), tipo: row.accion, propuesta: row.accion === 'PRÁCTICAS PROFESIONALIZANTES' ? 'Prácticas Educativas en Ambientes de Trabajo' : 'Club de Tecnología',
      fecha_inicio: row.fecha, fecha_cierre: e.es_cierre ? row.fecha : null, encuentros_previstos: previstos,
    }).select('id').single()
    if (error) throw new Error(error.message)
    return data.id as string
  }
  const { data: club, error } = await db.from('clubes').select('id, fecha_inicio, fecha_cierre').eq('id', e.club_id).eq('fed_id', row.fed_id).single()
  if (error) throw new Error('El club elegido no existe o no es de este FED')
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (previstos) patch.encuentros_previstos = previstos
  if (row.fecha < club.fecha_inicio) patch.fecha_inicio = row.fecha
  if (e.es_cierre) patch.fecha_cierre = row.fecha
  else if (club.fecha_cierre === row.fecha) patch.fecha_cierre = null
  const up = await db.from('clubes').update(patch).eq('id', club.id)
  if (up.error) throw new Error(up.error.message)
  return club.id
}

async function getClubesImpl(fedId?: string): Promise<Club[]> {
  let q = supabaseServer().from('clubes').select(`*, school:establecimientos(${SCHOOL_COLS}), encuentros:agenda_encuentros(id, fecha, propuesta, encuentro_n, inscriptos, asistentes, tipo_jornada, modalidad, destinatarios, es_cierre)`).order('fecha_inicio')
  if (fedId) q = q.eq('fed_id', fedId)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as Club[]
}

// Finalizar (fecha) o reactivar (null) un club desde el tablero.
async function setClubCierreImpl(id: string, fecha: string | null): Promise<void> {
  if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new Error('Fecha inválida')
  const db = supabaseServer()
  const { error } = await db.from('clubes').update({ fecha_cierre: fecha, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(error.message)
  if (!fecha) await db.from('agenda_encuentros').update({ es_cierre: false }).eq('club_id', id)
}

// Cambio rápido de estado desde el detalle; sólo sobre items del propio FED.
async function setItemStatusImpl(id: string, fedId: string, estado: AgendaItemInput['estado']): Promise<void> {
  if (!ESTADOS.includes(estado)) throw new Error('Estado inválido')
  const { error } = await supabaseServer().from('agenda_items').update({ estado }).eq('id', id).eq('fed_id', fedId)
  if (error) throw new Error(error.message)
}

async function deleteItemImpl(id: string, fedId: string): Promise<void> {
  const { error } = await supabaseServer().from('agenda_items').delete().eq('id', id).eq('fed_id', fedId)
  if (error) throw new Error(error.message)
}

async function getFeriadosImpl(from: string, to: string): Promise<Feriado[]> {
  const { data, error } = await supabaseServer().from('feriados').select('fecha, nombre, tipo, distrito, confirmado').gte('fecha', from).lte('fecha', to).order('fecha')
  if (error) throw new Error(error.message)
  return (data ?? []) as Feriado[]
}

export const getFeds = async () => run(() => getFedsImpl())
export const searchSchools = async (query: string) => run(() => searchSchoolsImpl(query))
export const getFedItems = async (fedId: string, from: string, to: string) => run(() => getFedItemsImpl(fedId, from, to))
export const getAllItems = async (from: string, to: string) => run(() => getAllItemsImpl(from, to))
export const getEncuentros = async (from: string, to: string) => run(() => getEncuentrosImpl(from, to))
export const saveItem = async (input: AgendaItemInput, id?: string) => run(() => saveItemImpl(input, id))
export const setItemStatus = async (id: string, fedId: string, estado: AgendaItemInput['estado']) => run(() => setItemStatusImpl(id, fedId, estado))
export const deleteItem = async (id: string, fedId: string) => run(() => deleteItemImpl(id, fedId))
export const getFeriados = async (from: string, to: string) => run(() => getFeriadosImpl(from, to))
export const getClubes = async (fedId?: string) => run(() => getClubesImpl(fedId))
export const setClubCierre = async (id: string, fecha: string | null) => run(() => setClubCierreImpl(id, fecha))
