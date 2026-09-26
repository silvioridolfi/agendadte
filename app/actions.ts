'use server'

import { supabaseServer } from '@/lib/supabase-server'
import { ACCIONES, CON_ENCUENTRO, ESTADOS, type AgendaItem, type AgendaItemInput, type Encuentro, type EncuentroInput, type Fed, type Feriado, type School, type Club, type Notificacion, MODALIDADES, TIPOS_JORNADA, CUE_DTE, esTrayecto, serieFechas } from '@/lib/agenda'

// En producción Next oculta el mensaje de los errores lanzados en server actions (React #441),
// así que se devuelven como valor y el cliente los vuelve a lanzar con el mensaje real.
export type Result<T> = { ok: true; data: T } | { ok: false; error: string }
async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try { return { ok: true, data: await fn() } } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) } }
}

const SCHOOL_COLS = 'id, cue, nombre, distrito, ciudad'

async function getFedsImpl(): Promise<Fed[]> {
  const { data, error } = await supabaseServer().from('feds').select('id, nombre_completo, distritos_a_cargo, carga_horaria, ddjj, rol').order('nombre_completo')
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

const ITEM_COLS = `*, school:establecimientos(${SCHOOL_COLS}), encuentros:agenda_encuentros(*), participantes:agenda_participantes(fed_id, respuesta)`

// Agenda de un FED: sus acciones y aquellas en las que fue etiquetado.
async function getFedItemsImpl(fedId: string, from: string, to: string): Promise<AgendaItem[]> {
  const db = supabaseServer()
  const propias = await fetchAll<AgendaItem>((a, b) => db.from('agenda_items').select(ITEM_COLS).eq('fed_id', fedId)
    .gte('fecha', from).lte('fecha', to).order('fecha').order('hora_inicio', { nullsFirst: true }).order('id').range(a, b))
  const { data: part, error } = await db.from('agenda_participantes').select('item_id').eq('fed_id', fedId)
  if (error) throw new Error(error.message)
  const ids = (part ?? []).map(p => p.item_id as string)
  if (!ids.length) return propias
  const compartidas: AgendaItem[] = []
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error: e2 } = await db.from('agenda_items').select(ITEM_COLS).in('id', ids.slice(i, i + 200)).gte('fecha', from).lte('fecha', to)
    if (e2) throw new Error(e2.message)
    compartidas.push(...((data ?? []) as AgendaItem[]))
  }
  const vistos = new Set(propias.map(i => i.id))
  return [...propias, ...compartidas.filter(i => !vistos.has(i.id))]
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hora_inicio ?? '').localeCompare(b.hora_inicio ?? ''))
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
  const { encuentro: _encuentro, participantes: _participantes, repeticion: _repeticion, ...row } = input
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

const fechaCorta = (f: string) => { const [y, m, d] = f.split('-'); return `${d}/${m}/${y}` }

// Historial de cambios (quién hizo qué y cuándo). No interrumpe la operación si falla.
async function audit(tabla: string, registroId: string | null, operacion: 'alta' | 'modificacion' | 'baja' | 'estado', autorId: string | null, datos?: unknown) {
  await supabaseServer().from('auditoria').insert({ tabla, registro_id: registroId, operacion, autor_id: autorId, datos: datos ?? null })
}

// Aviso a los compañeros etiquetados (sin quien hizo el cambio).
async function avisarParticipantes(itemId: string, autorId: string, tipo: 'modificacion' | 'cancelacion', detalle: string, conItem = true) {
  const db = supabaseServer()
  const { data } = await db.from('agenda_participantes').select('fed_id').eq('item_id', itemId)
  const destinos = (data ?? []).map(p => p.fed_id as string).filter(f => f !== autorId)
  if (destinos.length) await db.from('notificaciones').insert(destinos.map(fed_id => ({ fed_id, item_id: conItem ? itemId : null, autor_id: autorId, tipo, detalle })))
}

async function saveItemImpl(input: AgendaItemInput, id?: string): Promise<{ id: string, creadas: number }> {
  const row = clean(input)
  const db = supabaseServer()
  // Paro: se registra en el lugar de trabajo (DTE). Licencia: sin escuela ni lugar.
  if (row.accion === 'PARO') {
    const { data } = await db.from('establecimientos').select('id').eq('cue', CUE_DTE).limit(1).maybeSingle()
    Object.assign(row, { school_id: data?.id ?? null, lugar: data ? null : 'Dirección de Tecnología Educativa', sub_accion: null })
  }
  if (row.accion === 'LICENCIA') Object.assign(row, { school_id: null, lugar: null })
  // Estado anterior, para avisar a los compañeros qué cambió.
  const antes = id ? (await db.from('agenda_items').select('fecha, hora_inicio, hora_fin, school_id, lugar, estado, accion').eq('id', id).eq('fed_id', row.fed_id).maybeSingle()).data : null
  if (id && !antes) throw new Error('La acción no existe o no es tuya')
  const rowSinSerie = row
  // Al editar, el item debe pertenecer al FED que lo edita.
  const res = id ? await db.from('agenda_items').update(rowSinSerie).eq('id', id).eq('fed_id', row.fed_id).select('id').single()
    : await db.from('agenda_items').insert(rowSinSerie).select('id').single()
  if (res.error) throw new Error(res.error.message)
  const itemId = res.data.id as string
  if (input.participantes) await syncParticipantes(itemId, row.fed_id, input.participantes)

  // Encuentro: se edita el que se mostró en el formulario (puede ser uno importado) o se crea uno nuevo.
  // Si la acción deja de ser club/taller/prácticas, sólo se borra el encuentro creado desde la app; los importados se conservan.
  const esClub = esTrayecto(row.accion)
  const enc = CON_ENCUENTRO.includes(row.accion) && input.encuentro ? (cleanEncuentro(input.encuentro) ?? (esClub ? { propuesta: null, encuentro_n: null, modalidad: null, destinatarios: null, inscriptos: null, asistentes: null } : null)) : null
  const encId = input.encuentro?.id
  let clubId: string | null = null
  if (enc) {
    clubId = esClub ? await upsertClub(input, row) : null
    const encRow = { ...enc, id: undefined, agenda_item_id: itemId, fed_id: row.fed_id, school_id: row.school_id, lugar: row.lugar, fecha: row.fecha, tipo: row.accion, club_id: clubId, es_cierre: esClub && !!input.encuentro?.es_cierre }
    const { error } = encId ? await db.from('agenda_encuentros').update(encRow).eq('id', encId).eq('agenda_item_id', itemId) : await db.from('agenda_encuentros').insert(encRow)
    if (error) throw new Error(error.message)
    if (clubId) await db.from('agenda_items').update({ club_id: clubId }).eq('id', itemId)
  } else if (id) {
    const { error } = await db.from('agenda_encuentros').delete().eq('agenda_item_id', itemId).eq('origen', 'app')
    if (error) throw new Error(error.message)
  }

  // Cambios en una acción compartida: se avisa a los compañeros.
  if (antes) {
    const cambios: string[] = []
    if (antes.fecha !== row.fecha) cambios.push(`fecha ${fechaCorta(antes.fecha)} → ${fechaCorta(row.fecha)}`)
    if ((antes.hora_inicio ?? '').slice(0, 5) !== (row.hora_inicio ?? '').slice(0, 5) || (antes.hora_fin ?? '').slice(0, 5) !== (row.hora_fin ?? '').slice(0, 5)) cambios.push('horario')
    if (antes.school_id !== row.school_id || (antes.lugar ?? null) !== (row.lugar ?? null)) cambios.push('lugar')
    if (antes.accion !== row.accion) cambios.push('tipo de acción')
    if (antes.estado !== row.estado) cambios.push(`estado: ${row.estado}`)
    if (row.estado === 'cancelada' && antes.estado !== 'cancelada') await avisarParticipantes(itemId, row.fed_id, 'cancelacion', 'Canceló la acción')
    else if (cambios.length) await avisarParticipantes(itemId, row.fed_id, 'modificacion', `Cambió ${cambios.join(', ')}`)
  }
  await audit('agenda_items', itemId, id ? 'modificacion' : 'alta', row.fed_id, { accion: row.accion, fecha: row.fecha, estado: row.estado })

  // Serie: la misma acción en los días elegidos hasta la fecha indicada (sin feriados ni receso).
  let creadas = 1
  if (!id && input.repeticion?.dias.length && input.repeticion.hasta) {
    const { data: fer } = await db.from('feriados').select('fecha, tipo, distrito').gt('fecha', row.fecha).lte('fecha', input.repeticion.hasta)
    const { data: yo } = await db.from('feds').select('distritos_a_cargo').eq('id', row.fed_id).maybeSingle()
    const mios = new Set((yo?.distritos_a_cargo as string[] | undefined) ?? [])
    const noLaborables = new Set((fer ?? []).filter(f => f.tipo !== 'distrital' || mios.has(f.distrito)).map(f => f.fecha as string))
    const fechas = serieFechas(row.fecha, input.repeticion.dias, input.repeticion.hasta, noLaborables)
    if (fechas.length) {
      const serieId = crypto.randomUUID()
      await db.from('agenda_items').update({ serie_id: serieId }).eq('id', itemId)
      const copia = { ...rowSinSerie, estado: 'planificada' as const, serie_id: serieId, club_id: clubId }
      const ins = await db.from('agenda_items').insert(fechas.map(fecha => ({ ...copia, fecha }))).select('id')
      if (ins.error) throw new Error(ins.error.message)
      const otros = (input.participantes ?? []).filter(f => f && f !== row.fed_id)
      if (otros.length) {
        const p = await db.from('agenda_participantes').insert((ins.data ?? []).flatMap(it => otros.map(fed_id => ({ item_id: it.id, fed_id }))))
        if (p.error) throw new Error(p.error.message)
        await db.from('notificaciones').update({ detalle: `Se repite: ${fechas.length + 1} fechas hasta el ${fechaCorta(input.repeticion.hasta)}` }).eq('item_id', itemId).eq('tipo', 'etiqueta')
      }
      creadas += fechas.length
    }
  }
  return { id: itemId, creadas }
}

// Compañeros etiquetados: se reemplaza la lista y se notifica a quienes se suman.
async function syncParticipantes(itemId: string, autorId: string, fedIds: string[]) {
  const db = supabaseServer()
  const quiero = [...new Set(fedIds.filter(f => f && f !== autorId))]
  const { data: actuales, error } = await db.from('agenda_participantes').select('fed_id').eq('item_id', itemId)
  if (error) throw new Error(error.message)
  const ya = new Set((actuales ?? []).map(p => p.fed_id as string))
  const quitar = [...ya].filter(f => !quiero.includes(f)), sumar = quiero.filter(f => !ya.has(f))
  if (quitar.length) { const r = await db.from('agenda_participantes').delete().eq('item_id', itemId).in('fed_id', quitar); if (r.error) throw new Error(r.error.message) }
  if (sumar.length) {
    const r = await db.from('agenda_participantes').insert(sumar.map(fed_id => ({ item_id: itemId, fed_id })))
    if (r.error) throw new Error(r.error.message)
    const n = await db.from('notificaciones').insert(sumar.map(fed_id => ({ fed_id, item_id: itemId, autor_id: autorId, tipo: 'etiqueta' })))
    if (n.error) throw new Error(n.error.message)
  }
}

async function getNotificacionesImpl(fedId: string): Promise<Notificacion[]> {
  const { data, error } = await supabaseServer().from('notificaciones').select(`id, tipo, leida, created_at, autor_id, detalle, item:agenda_items(${ITEM_COLS})`)
    .eq('fed_id', fedId).order('created_at', { ascending: false }).limit(30)
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as Notificacion[]
}

async function marcarLeidasImpl(fedId: string, ids?: string[]): Promise<void> {
  let q = supabaseServer().from('notificaciones').update({ leida: true }).eq('fed_id', fedId).eq('leida', false)
  if (ids?.length) q = q.in('id', ids)
  const { error } = await q
  if (error) throw new Error(error.message)
}

// Club del encuentro: crea uno nuevo (inicia en esta fecha) o actualiza el elegido; marcar cierre lo finaliza.
async function upsertClub(input: AgendaItemInput, row: ReturnType<typeof clean>): Promise<string | null> {
  const e = input.encuentro!
  const db = supabaseServer()
  const previstos = num(e.encuentros_previstos) || null
  if (e.nuevo_club || !e.club_id) {
    if (!e.nuevo_club) return null
    const { data, error } = await db.from('clubes').insert({
      fed_id: row.fed_id, school_id: row.school_id, lugar: row.lugar, grupo: opt(e.grupo), escuela_origen_id: opt(e.escuela_origen_id), tipo: row.accion, propuesta: row.accion === 'PRÁCTICAS PROFESIONALIZANTES' ? 'Prácticas Educativas en Ambientes de Trabajo' : 'Club de Tecnología',
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
  let q = supabaseServer().from('clubes').select(`*, school:establecimientos!clubes_school_id_fkey(${SCHOOL_COLS}), escuela_origen:establecimientos!clubes_escuela_origen_id_fkey(${SCHOOL_COLS}), encuentros:agenda_encuentros(id, fecha, propuesta, school_id, lugar, school:establecimientos(${SCHOOL_COLS}), encuentro_n, inscriptos, asistentes, tipo_jornada, modalidad, destinatarios, es_cierre)`).order('fecha_inicio')
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
  const { data, error } = await supabaseServer().from('agenda_items').update({ estado }).eq('id', id).eq('fed_id', fedId).select('id')
  if (error) throw new Error(error.message)
  if (!data?.length) throw new Error('Sólo quien creó la acción puede cambiar su estado')
  if (estado === 'cancelada') await avisarParticipantes(id, fedId, 'cancelacion', 'Canceló la acción')
  else if (estado === 'reprogramada') await avisarParticipantes(id, fedId, 'modificacion', 'La marcó como reprogramada')
  await audit('agenda_items', id, 'estado', fedId, { estado })
}

// Eliminar una acción; con `serie`, también las siguientes planificadas de la misma serie.
async function deleteItemImpl(id: string, fedId: string, serie = false): Promise<number> {
  const db = supabaseServer()
  const { data: item } = await db.from('agenda_items').select('id, fecha, accion, serie_id').eq('id', id).eq('fed_id', fedId).maybeSingle()
  if (!item) throw new Error('La acción no existe o no es tuya')
  let ids = [id]
  if (serie && item.serie_id) {
    const { data } = await db.from('agenda_items').select('id').eq('serie_id', item.serie_id).eq('fed_id', fedId).eq('estado', 'planificada').gt('fecha', item.fecha)
    ids = [id, ...(data ?? []).map(x => x.id as string)]
  }
  await avisarParticipantes(id, fedId, 'cancelacion', `Eliminó ${item.accion.toLowerCase()} del ${fechaCorta(item.fecha)}${ids.length > 1 ? ` y ${ids.length - 1} fechas siguientes` : ''}`, false)
  const { error } = await db.from('agenda_items').delete().in('id', ids).eq('fed_id', fedId)
  if (error) throw new Error(error.message)
  await audit('agenda_items', id, 'baja', fedId, { accion: item.accion, fecha: item.fecha, cantidad: ids.length })
  return ids.length
}

// Respuesta de un compañero etiquetado; se avisa a quien creó la acción.
async function responderImpl(itemId: string, fedId: string, respuesta: 'acepta' | 'rechaza'): Promise<void> {
  const db = supabaseServer()
  const { data, error } = await db.from('agenda_participantes').update({ respuesta }).eq('item_id', itemId).eq('fed_id', fedId).select('item_id')
  if (error) throw new Error(error.message)
  if (!data?.length) throw new Error('No estás etiquetado en esta acción')
  const { data: item } = await db.from('agenda_items').select('fed_id').eq('id', itemId).maybeSingle()
  if (item) await db.from('notificaciones').insert({ fed_id: item.fed_id, item_id: itemId, autor_id: fedId, tipo: 'respuesta', detalle: respuesta === 'acepta' ? 'Confirmó que participa' : 'Avisó que no puede participar' })
}

async function getHistorialImpl(itemId: string): Promise<{ operacion: string, autor_id: string | null, created_at: string, datos: Record<string, unknown> | null }[]> {
  const { data, error } = await supabaseServer().from('auditoria').select('operacion, autor_id, created_at, datos').eq('registro_id', itemId).order('created_at', { ascending: false }).limit(20)
  if (error) throw new Error(error.message)
  return data ?? []
}

// ---- Administración (sólo coordinación): equipo y feriados.
async function esCoordinacion(autorId: string) {
  const { data } = await supabaseServer().from('feds').select('rol').eq('id', autorId).maybeSingle()
  if (data?.rol !== 'coordinacion') throw new Error('Sólo coordinación puede hacer este cambio')
}

async function updateFedImpl(autorId: string, fed: Pick<Fed, 'id' | 'nombre_completo' | 'distritos_a_cargo' | 'carga_horaria' | 'ddjj'>): Promise<void> {
  await esCoordinacion(autorId)
  if (!fed.nombre_completo.trim()) throw new Error('El nombre es obligatorio')
  const patch = { nombre_completo: fed.nombre_completo.trim(), distritos_a_cargo: fed.distritos_a_cargo.map(d => d.trim().toUpperCase()).filter(Boolean), carga_horaria: opt(fed.carga_horaria), ddjj: fed.ddjj }
  const { error } = await supabaseServer().from('feds').update(patch).eq('id', fed.id)
  if (error) throw new Error(error.message)
  await audit('feds', fed.id, 'modificacion', autorId, patch)
}

async function addFeriadoImpl(autorId: string, f: Omit<Feriado, 'id'>): Promise<void> {
  await esCoordinacion(autorId)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.fecha) || !f.nombre.trim()) throw new Error('Fecha y nombre son obligatorios')
  const { error } = await supabaseServer().from('feriados').insert({ fecha: f.fecha, nombre: f.nombre.trim(), tipo: f.tipo, distrito: f.tipo === 'distrital' ? opt(f.distrito)?.toUpperCase() ?? null : null, confirmado: f.confirmado })
  if (error) throw new Error(error.code === '23505' ? 'Ya hay un feriado cargado ese día' : error.message)
  await audit('feriados', null, 'alta', autorId, f)
}

async function deleteFeriadoImpl(autorId: string, id: string): Promise<void> {
  await esCoordinacion(autorId)
  const { error } = await supabaseServer().from('feriados').delete().eq('id', id)
  if (error) throw new Error(error.message)
  await audit('feriados', id, 'baja', autorId)
}

async function getFeriadosImpl(from: string, to: string): Promise<Feriado[]> {
  const { data, error } = await supabaseServer().from('feriados').select('id, fecha, nombre, tipo, distrito, confirmado').gte('fecha', from).lte('fecha', to).order('fecha')
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
export const deleteItem = async (id: string, fedId: string, serie = false) => run(() => deleteItemImpl(id, fedId, serie))
export const getFeriados = async (from: string, to: string) => run(() => getFeriadosImpl(from, to))
export const getClubes = async (fedId?: string) => run(() => getClubesImpl(fedId))
export const setClubCierre = async (id: string, fecha: string | null) => run(() => setClubCierreImpl(id, fecha))
export const getNotificaciones = async (fedId: string) => run(() => getNotificacionesImpl(fedId))
export const marcarLeidas = async (fedId: string, ids?: string[]) => run(() => marcarLeidasImpl(fedId, ids))
export const responder = async (itemId: string, fedId: string, respuesta: 'acepta' | 'rechaza') => run(() => responderImpl(itemId, fedId, respuesta))
export const getHistorial = async (itemId: string) => run(() => getHistorialImpl(itemId))
export const updateFed = async (autorId: string, fed: Pick<Fed, 'id' | 'nombre_completo' | 'distritos_a_cargo' | 'carga_horaria' | 'ddjj'>) => run(() => updateFedImpl(autorId, fed))
export const addFeriado = async (autorId: string, f: Omit<Feriado, 'id'>) => run(() => addFeriadoImpl(autorId, f))
export const deleteFeriado = async (autorId: string, id: string) => run(() => deleteFeriadoImpl(autorId, id))
