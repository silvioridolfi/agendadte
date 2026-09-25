'use server'

import { supabaseServer } from '@/lib/supabase-server'
import { ACCIONES, ESTADOS, type AgendaItem, type AgendaItemInput, type Fed, type School } from '@/lib/agenda'

// En producción Next oculta el mensaje de los errores lanzados en server actions (React #441),
// así que se devuelven como valor y el cliente los vuelve a lanzar con el mensaje real.
export type Result<T> = { ok: true; data: T } | { ok: false; error: string }
async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try { return { ok: true, data: await fn() } } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) } }
}

const SCHOOL_COLS = 'id, cue, nombre, nombre_completo, distrito'
const schools = () => supabaseServer().schema('bitacora_pp').from('schools')

async function getFedsImpl(): Promise<Fed[]> {
  const { data, error } = await supabaseServer().from('feds').select('id, nombre_completo, distritos_a_cargo').order('nombre_completo')
  if (error) throw new Error(error.message)
  return data ?? []
}

async function searchSchoolsImpl(query: string): Promise<School[]> {
  const q = query.trim()
  if (q.length < 2) return []
  let req = schools().select(SCHOOL_COLS).limit(15)
  if (/^\d+$/.test(q)) req = req.eq('cue', Number(q))
  else {
    const like = `%${q.replace(/[%_,()]/g, ' ')}%`
    req = req.or(`nombre.ilike.${like},nombre_completo.ilike.${like}`)
  }
  const { data, error } = await req.order('nombre')
  if (error) throw new Error(error.message)
  return data ?? []
}

// `schools` vive en el esquema bitacora_pp, así que no se puede embeber en la consulta: se resuelve aparte.
async function withSchools(rows: Omit<AgendaItem, 'school'>[]): Promise<AgendaItem[]> {
  const ids = [...new Set(rows.map(r => r.school_id).filter((id): id is string => !!id))]
  const byId = new Map<string, School>()
  if (ids.length) {
    const { data, error } = await schools().select(SCHOOL_COLS).in('id', ids)
    if (error) throw new Error(error.message)
    for (const s of data ?? []) byId.set(s.id, s)
  }
  return rows.map(r => ({ ...r, school: r.school_id ? byId.get(r.school_id) ?? null : null }))
}

function itemsQuery(from: string, to: string) {
  return supabaseServer().from('agenda_items').select('*').gte('fecha', from).lte('fecha', to)
    .order('fecha').order('hora_inicio', { nullsFirst: true })
}

async function getFedItemsImpl(fedId: string, from: string, to: string): Promise<AgendaItem[]> {
  const { data, error } = await itemsQuery(from, to).eq('fed_id', fedId)
  if (error) throw new Error(error.message)
  return withSchools(data ?? [])
}

async function getAllItemsImpl(from: string, to: string): Promise<AgendaItem[]> {
  const { data, error } = await itemsQuery(from, to)
  if (error) throw new Error(error.message)
  return withSchools(data ?? [])
}

function clean(input: AgendaItemInput): AgendaItemInput {
  if (!input.fed_id || !/^\d{4}-\d{2}-\d{2}$/.test(input.fecha)) throw new Error('FED y fecha son obligatorios')
  if (!ACCIONES.includes(input.accion) || !ESTADOS.includes(input.estado)) throw new Error('Acción o estado inválido')
  const opt = (v: string | null) => (v && v.trim() ? v.trim() : null)
  return { ...input, school_id: opt(input.school_id), hora_inicio: opt(input.hora_inicio), hora_fin: opt(input.hora_fin), sub_accion: opt(input.sub_accion), detalle: opt(input.detalle) }
}

async function saveItemImpl(input: AgendaItemInput, id?: string): Promise<void> {
  const row = clean(input)
  const table = supabaseServer().from('agenda_items')
  // Al editar, el item debe pertenecer al FED que lo edita.
  const { error } = id ? await table.update(row).eq('id', id).eq('fed_id', row.fed_id) : await table.insert(row)
  if (error) throw new Error(error.message)
}

export const getFeds = async () => run(() => getFedsImpl())
export const searchSchools = async (query: string) => run(() => searchSchoolsImpl(query))
export const getFedItems = async (fedId: string, from: string, to: string) => run(() => getFedItemsImpl(fedId, from, to))
export const getAllItems = async (from: string, to: string) => run(() => getAllItemsImpl(from, to))
export const saveItem = async (input: AgendaItemInput, id?: string) => run(() => saveItemImpl(input, id))
