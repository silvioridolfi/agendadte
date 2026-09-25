'use server'

import { supabaseServer } from '@/lib/supabase-server'
import { ACCIONES, CON_ENCUENTRO, ESTADOS, type AgendaItem, type AgendaItemInput, type Encuentro, type EncuentroInput, type Fed, type School } from '@/lib/agenda'

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
    modalidad: e.modalidad === 'Presencial' || e.modalidad === 'Virtual' ? e.modalidad : null, inscriptos: num(e.inscriptos), asistentes: num(e.asistentes),
  }
  return out.propuesta || out.encuentro_n || out.destinatarios || out.inscriptos != null || out.asistentes != null ? out : null
}

async function saveItemImpl(input: AgendaItemInput, id?: string): Promise<void> {
  const row = clean(input)
  const db = supabaseServer()
  // Al editar, el item debe pertenecer al FED que lo edita.
  const res = id ? await db.from('agenda_items').update(row).eq('id', id).eq('fed_id', row.fed_id).select('id').single()
    : await db.from('agenda_items').insert(row).select('id').single()
  if (res.error) throw new Error(res.error.message)
  const itemId = res.data.id as string

  // Encuentro: se edita el que se mostró en el formulario (puede ser uno importado) o se crea uno nuevo.
  // Si la acción deja de ser club/taller/prácticas, sólo se borra el encuentro creado desde la app; los importados se conservan.
  const enc = CON_ENCUENTRO.includes(row.accion) && input.encuentro ? cleanEncuentro(input.encuentro) : null
  const encId = input.encuentro?.id
  if (enc) {
    const encRow = { ...enc, agenda_item_id: itemId, fed_id: row.fed_id, school_id: row.school_id, lugar: row.lugar, fecha: row.fecha, tipo: row.accion }
    const { error } = encId ? await db.from('agenda_encuentros').update(encRow).eq('id', encId).eq('agenda_item_id', itemId) : await db.from('agenda_encuentros').insert(encRow)
    if (error) throw new Error(error.message)
  } else if (id) {
    const { error } = await db.from('agenda_encuentros').delete().eq('agenda_item_id', itemId).eq('origen', 'app')
    if (error) throw new Error(error.message)
  }
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

export const getFeds = async () => run(() => getFedsImpl())
export const searchSchools = async (query: string) => run(() => searchSchoolsImpl(query))
export const getFedItems = async (fedId: string, from: string, to: string) => run(() => getFedItemsImpl(fedId, from, to))
export const getAllItems = async (from: string, to: string) => run(() => getAllItemsImpl(from, to))
export const getEncuentros = async (from: string, to: string) => run(() => getEncuentrosImpl(from, to))
export const saveItem = async (input: AgendaItemInput, id?: string) => run(() => saveItemImpl(input, id))
export const setItemStatus = async (id: string, fedId: string, estado: AgendaItemInput['estado']) => run(() => setItemStatusImpl(id, fedId, estado))
export const deleteItem = async (id: string, fedId: string) => run(() => deleteItemImpl(id, fedId))
