'use server'

import { supabaseServer } from '@/lib/supabase-server'
import { ACCIONES, CON_ENCUENTRO, ESTADOS, type AgendaItem, type AgendaItemInput, type Encuentro, type EncuentroInput, type Fed, type Feriado, type School, type Club, type Notificacion, DISTRITOS_REGION, MODALIDADES, MODALIDADES_EVENTO, ROLES_FORMACION, type EventoDte, TIPOS_JORNADA, CUE_DTE, esTrayecto, serieFechas } from '@/lib/agenda'
import { borrarSesion, guardarSesion, passwordTemporal, requerirUsuario, usuarioActual, usuarioDeSesion, validarPassword, type Usuario } from '@/lib/sesion'
import { DriveError, cuentaTecnica, driveConfigurado, idDeCarpeta, urlCarpeta, verificarCarpeta } from '@/lib/drive'
import { ordenarFotos } from '@/lib/fotos'
import { PRIMER_MES, inicioMes, hoyAR as hoyPve, nombreMes, noLaborables, revisarPve, vencimientoPve } from '@/lib/pve'
import { armarDdjj, cargaDeDdjj, cargosDe, franjasDte, validarDdjj } from '@/lib/ddjj'

// En producción Next oculta el mensaje de los errores lanzados en server actions (React #441),
// así que se devuelven como valor y el cliente los vuelve a lanzar con el mensaje real.
export type Result<T> = { ok: true; data: T } | { ok: false; error: string }
const errMsgServer = (e: unknown) => (e instanceof Error ? e.message : String(e))
async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try { return { ok: true, data: await fn() } } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) } }
}

const SCHOOL_COLS = 'id, cue, nombre, distrito, ciudad'

async function getFedsImpl(): Promise<Fed[]> {
  const { data, error } = await supabaseServer().from('feds').select('id, nombre_completo, distritos_a_cargo, carga_horaria, ddjj, rol, carpeta_fotos_url').order('nombre_completo')
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

const ITEM_COLS = `*, school:establecimientos(${SCHOOL_COLS}), encuentros:agenda_encuentros(*), participantes:agenda_participantes(fed_id, respuesta), club:clubes(grupo)`

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
// Métricas: sólo cuentan los encuentros realizados (los importados de la planilla no tienen acción y se cuentan).
type ConItem = { item?: { estado: string } | null, agenda_item_id?: string | null }
const realizado = (e: ConItem) => !e.agenda_item_id || e.item?.estado === 'realizada'
function sinItem<T extends ConItem>(e: T) { const { item: _item, ...resto } = e; return resto }

async function getEncuentrosImpl(from: string, to: string): Promise<Encuentro[]> {
  const l = await fetchAll<Encuentro & ConItem>((a, b) => supabaseServer().from('agenda_encuentros').select(`*, school:establecimientos(${SCHOOL_COLS}), item:agenda_items(estado)`)
    .gte('fecha', from).lte('fecha', to).order('fecha').order('id').range(a, b))
  return l.filter(realizado).map(sinItem) as Encuentro[]
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
    // Datos propios de la formación interna (en otras acciones quedan vacíos).
    modalidad: (input.accion === 'FORMACIÓN INTERNA' || input.accion === 'EVENTO DTE') && input.modalidad && MODALIDADES_EVENTO.includes(input.modalidad) ? input.modalidad : null,
    rol_formacion: input.accion === 'FORMACIÓN INTERNA' && input.rol_formacion && ROLES_FORMACION.includes(input.rol_formacion) ? input.rol_formacion : null,
    dictada_por: input.accion === 'FORMACIÓN INTERNA' ? opt(input.dictada_por ?? null) : null,
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

async function saveItemImpl(input: AgendaItemInput, id?: string, alcance: 'uno' | 'siguientes' = 'uno'): Promise<{ id: string, creadas: number }> {
  const row = clean(input)
  const db = supabaseServer()
  // Paro: se registra en el lugar de trabajo (DTE). Licencia: sin escuela ni lugar.
  if (row.accion === 'PARO') {
    const { data } = await db.from('establecimientos').select('id').eq('cue', CUE_DTE).limit(1).maybeSingle()
    Object.assign(row, { school_id: data?.id ?? null, lugar: data ? null : 'Dirección de Tecnología Educativa', sub_accion: null })
  }
  if (row.accion === 'LICENCIA') Object.assign(row, { school_id: null, lugar: null })
  // Estado anterior, para avisar a los compañeros qué cambió.
  const antes = id ? (await db.from('agenda_items').select('serie_id, fecha, hora_inicio, hora_fin, school_id, lugar, estado, accion').eq('id', id).eq('fed_id', row.fed_id).maybeSingle()).data : null
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
    // N° de encuentro automático: el siguiente al último registrado del club hasta esa fecha (los números cargados se respetan).
    if (clubId && !enc.encuentro_n) enc.encuentro_n = await siguienteEncuentro(clubId, row.fecha, itemId)
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
  // Edición de una serie: "este y los siguientes" aplica horario, club/grupo y datos de la propuesta a las fechas planificadas que siguen
  // (no cambia la fecha de cada una ni los datos de participación, que son propios de cada encuentro).
  if (id && alcance === 'siguientes' && antes?.serie_id) {
    const { data: sig } = await db.from('agenda_items').select('id').eq('serie_id', antes.serie_id).eq('fed_id', row.fed_id).eq('estado', 'planificada').gt('fecha', row.fecha)
    const ids = (sig ?? []).map(x => x.id as string)
    if (ids.length) {
      // El club/grupo también se aplica a las siguientes (p. ej., corregir 4° → 5° en toda la serie).
      const up = await db.from('agenda_items').update({ hora_inicio: row.hora_inicio, hora_fin: row.hora_fin, school_id: row.school_id, lugar: row.lugar, sub_accion: row.sub_accion, ...(clubId ? { club_id: clubId } : {}) }).in('id', ids).eq('fed_id', row.fed_id)
      if (up.error) throw new Error(up.error.message)
      if (enc) {
        const e = await db.from('agenda_encuentros').update({ propuesta: enc.propuesta, tipo_jornada: enc.tipo_jornada ?? null, modalidad: enc.modalidad, destinatarios: enc.destinatarios, school_id: row.school_id, lugar: row.lugar, ...(clubId ? { club_id: clubId } : {}) }).in('agenda_item_id', ids)
        if (e.error) throw new Error(e.error.message)
      }
      creadas += ids.length
      await audit('agenda_items', itemId, 'modificacion', row.fed_id, { serie: antes.serie_id, siguientes: ids.length })
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

async function siguienteEncuentro(clubId: string, fecha: string, excluirItem: string): Promise<number> {
  const { data } = await supabaseServer().from('agenda_encuentros').select('fecha, encuentro_n, agenda_item_id').eq('club_id', clubId).lte('fecha', fecha)
  const previos = (data ?? []).filter(e => e.agenda_item_id !== excluirItem)
  const max = previos.reduce((m, e) => Math.max(m, e.encuentro_n ?? 0), 0)
  return Math.max(max, new Set(previos.map(e => e.fecha)).size) + 1
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
  if (!club.fecha_inicio || row.fecha < club.fecha_inicio) patch.fecha_inicio = row.fecha
  if (e.es_cierre) patch.fecha_cierre = row.fecha
  else if (club.fecha_cierre === row.fecha) patch.fecha_cierre = null
  const up = await db.from('clubes').update(patch).eq('id', club.id)
  if (up.error) throw new Error(up.error.message)
  return club.id
}

// Club o práctica "por iniciar": se planifica sin fecha y sin acción en la agenda; la fecha de inicio
// se completa al programar el primer encuentro desde el formulario.
export type ClubPorIniciarInput = { fed_id: string, tipo: 'CLUB DE TECNOLOGÍA' | 'PRÁCTICAS PROFESIONALIZANTES', school_id: string | null, lugar: string | null, grupo: string, escuela_origen_id: string | null, encuentros_previstos: number | null }
async function crearClubPorIniciarImpl(c: ClubPorIniciarInput): Promise<void> {
  const db = supabaseServer()
  const { data: fed } = await db.from('feds').select('rol').eq('id', c.fed_id).maybeSingle()
  if (fed?.rol !== 'fed') throw new Error('Sólo un FED puede iniciar clubes o prácticas')
  if (c.tipo !== 'CLUB DE TECNOLOGÍA' && c.tipo !== 'PRÁCTICAS PROFESIONALIZANTES') throw new Error('Tipo inválido')
  if (!c.school_id && !opt(c.lugar)) throw new Error('Indicá el establecimiento o la sede')
  if (!opt(c.grupo)) throw new Error('Indicá el grado o curso')
  const previstos = c.encuentros_previstos && c.encuentros_previstos > 0 && c.encuentros_previstos < 100 ? Math.round(c.encuentros_previstos) : null
  const row = { fed_id: c.fed_id, school_id: c.school_id, lugar: c.school_id ? null : opt(c.lugar), grupo: opt(c.grupo), escuela_origen_id: opt(c.escuela_origen_id), tipo: c.tipo,
    propuesta: c.tipo === 'PRÁCTICAS PROFESIONALIZANTES' ? 'Prácticas Educativas en Ambientes de Trabajo' : 'Club de Tecnología', fecha_inicio: null, fecha_cierre: null, encuentros_previstos: previstos }
  const { data, error } = await db.from('clubes').insert(row).select('id').single()
  if (error) throw new Error(error.message)
  await audit('clubes', data.id as string, 'alta', c.fed_id, row)
}

async function getClubesImpl(fedId?: string): Promise<Club[]> {
  let q = supabaseServer().from('clubes').select(`*, school:establecimientos!clubes_school_id_fkey(${SCHOOL_COLS}), escuela_origen:establecimientos!clubes_escuela_origen_id_fkey(${SCHOOL_COLS}), encuentros:agenda_encuentros(id, fecha, propuesta, school_id, lugar, school:establecimientos(${SCHOOL_COLS}), encuentro_n, inscriptos, asistentes, tipo_jornada, modalidad, destinatarios, es_cierre, agenda_item_id, item:agenda_items(estado))`).order('fecha_inicio')
  if (fedId) q = q.eq('fed_id', fedId)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return ((data ?? []) as (Club & { encuentros: (Club['encuentros'][number] & ConItem)[] })[]).map(c => ({ ...c, encuentros: c.encuentros.filter(realizado).map(e => { const { agenda_item_id: _id, ...r } = sinItem(e); return r }) })) as Club[]
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
  const { data } = await supabaseServer().from('feds').select('es_admin').eq('id', autorId).maybeSingle()
  if (!data?.es_admin) throw new Error('Sólo administración puede hacer este cambio')
}

async function updateMiPerfilImpl(fedId: string, datos: Pick<Fed, 'distritos_a_cargo' | 'carga_horaria' | 'ddjj'>): Promise<void> {
  const db = supabaseServer()
  const { data: fed } = await db.from('feds').select('rol').eq('id', fedId).maybeSingle()
  if (!fed) throw new Error('No se encontró el perfil')
  const distritos = [...new Set(datos.distritos_a_cargo.map(d => d.trim().toUpperCase()))].filter(d => DISTRITOS_REGION.includes(d))
  const franjas = Object.fromEntries(datos.ddjj.map(d => [d.dia, franjasDte(d)]))
  const errores = validarDdjj(franjas, cargosDe(datos.ddjj))
  if (datos.ddjj.some(d => !Number.isInteger(d.dia) || d.dia < 1 || d.dia > 5)) errores.push('Día de la DD.JJ. inválido')
  if (errores.length) throw new Error(errores[0])
  const ddjj = armarDdjj(franjas, cargosDe(datos.ddjj), Object.fromEntries(datos.ddjj.filter(d => d.externo).map(d => [d.dia, d.externo!.slice(0, 200)])))
  const patch = { distritos_a_cargo: distritos, carga_horaria: cargaDeDdjj(ddjj), ddjj }
  const { error } = await db.from('feds').update(patch).eq('id', fedId)
  if (error) throw new Error(error.message)
  await audit('feds', fedId, 'modificacion', fedId, patch)
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

// ---- Acciones en bloque (selección múltiple): sólo sobre acciones propias; un aviso por compañero, no uno por acción.
const hoyAR = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
async function propias(ids: string[], fedId: string) {
  if (!ids.length || ids.length > 300) throw new Error('Seleccioná entre 1 y 300 acciones')
  const { data, error } = await supabaseServer().from('agenda_items').select('id, fecha, accion, estado, club_id').in('id', ids).eq('fed_id', fedId)
  if (error) throw new Error(error.message)
  return data ?? []
}
async function avisarEnBloque(ids: string[], autorId: string, detalle: string) {
  const db = supabaseServer()
  const { data } = await db.from('agenda_participantes').select('fed_id').in('item_id', ids)
  const destinos = [...new Set((data ?? []).map(p => p.fed_id as string))].filter(f => f !== autorId)
  if (destinos.length) await db.from('notificaciones').insert(destinos.map(fed_id => ({ fed_id, item_id: null, autor_id: autorId, tipo: 'cancelacion', detalle })))
}
async function cambiarEstadoVariasImpl(ids: string[], fedId: string, estado: AgendaItemInput['estado']) {
  if (!ESTADOS.includes(estado)) throw new Error('Estado inválido')
  const lista = await propias(ids, fedId)
  // "Realizada" no se aplica a fechas futuras.
  const futuras = estado === 'realizada' ? lista.filter(i => i.fecha > hoyAR()) : []
  const aplicar = lista.filter(i => !futuras.includes(i) && i.estado !== estado).map(i => i.id as string)
  if (aplicar.length) {
    const { error } = await supabaseServer().from('agenda_items').update({ estado }).in('id', aplicar).eq('fed_id', fedId)
    if (error) throw new Error(error.message)
    if (estado === 'cancelada') await avisarEnBloque(aplicar, fedId, `Canceló ${aplicar.length} ${aplicar.length === 1 ? 'acción' : 'acciones'}`)
    await audit('agenda_items', null, 'estado', fedId, { estado, ids: aplicar })
  }
  // Clubes y prácticas marcados como realizados sin datos de participación.
  let sinDatos = 0
  const clubes = lista.filter(i => aplicar.includes(i.id) && i.club_id).map(i => i.id as string)
  if (estado === 'realizada' && clubes.length) {
    const { data } = await supabaseServer().from('agenda_encuentros').select('agenda_item_id, asistentes').in('agenda_item_id', clubes)
    const conDatos = new Set((data ?? []).filter(e => e.asistentes != null).map(e => e.agenda_item_id))
    sinDatos = clubes.filter(id => !conDatos.has(id)).length
  }
  return { actualizadas: aplicar.length, futuras: futuras.length, ajenas: ids.length - lista.length, sinDatos }
}
async function eliminarVariasImpl(ids: string[], fedId: string) {
  const lista = await propias(ids, fedId)
  const borrar = lista.map(i => i.id as string)
  if (!borrar.length) return 0
  await avisarEnBloque(borrar, fedId, `Eliminó ${borrar.length} ${borrar.length === 1 ? 'acción' : 'acciones'} de su agenda`)
  const { error } = await supabaseServer().from('agenda_items').delete().in('id', borrar).eq('fed_id', fedId)
  if (error) throw new Error(error.message)
  await audit('agenda_items', null, 'baja', fedId, { ids: borrar, fechas: lista.map(i => i.fecha) })
  return borrar.length
}
// Acciones cargadas en fin de semana: pasan al viernes anterior o al lunes siguiente (también su encuentro, si tiene).
async function moverFinDeSemanaImpl(ids: string[], fedId: string, destino: 'viernes' | 'lunes') {
  const lista = await propias(ids, fedId)
  const db = supabaseServer()
  let movidas = 0
  for (const i of lista) {
    const d = new Date(`${i.fecha}T12:00:00`), dia = d.getDay()
    if (dia !== 0 && dia !== 6) continue
    d.setDate(d.getDate() + (destino === 'viernes' ? (dia === 6 ? -1 : -2) : (dia === 6 ? 2 : 1)))
    const nueva = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const up = await db.from('agenda_items').update({ fecha: nueva }).eq('id', i.id).eq('fed_id', fedId)
    if (up.error) throw new Error(up.error.message)
    await db.from('agenda_encuentros').update({ fecha: nueva }).eq('agenda_item_id', i.id)
    movidas++
  }
  if (movidas) await audit('agenda_items', null, 'modificacion', fedId, { mover_fin_de_semana: destino, ids: lista.map(i => i.id) })
  return movidas
}

// Todas las acciones exigen sesión. El perfil que actúa sale de la sesión, nunca de los parámetros del navegador.
const conUsuario = <T,>(fn: (yo: Usuario) => Promise<T>) => run(async () => fn(await requerirUsuario()))
export const getFeds = async () => conUsuario(() => getFedsImpl())
export const searchSchools = async (query: string) => conUsuario(() => searchSchoolsImpl(query))

// Jefaturas distritales y regional (organismos descentralizados, con código propio en lugar de CUE).
// Al elegir una se guarda como lugar "NOMBRE (CÓDIGO)", el mismo formato que venían usando a mano.
export type Organismo = { id: string, codigo: string, nombre: string, distrito: string | null, localidad: string | null, domicilio: string | null, lat: number | null, lon: number | null }
const sinTildes = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
async function organismos(): Promise<Organismo[]> {
  const { data, error } = await supabaseServer().from('organismos_descentralizados').select('id, codigo, nombre, distrito, localidad, domicilio, latitud, longitud').order('nombre')
  if (error) throw new Error(error.message)
  return (data ?? []).map(o => ({ id: o.id, codigo: o.codigo, nombre: o.nombre, distrito: o.distrito, localidad: o.localidad, domicilio: o.domicilio, lat: o.latitud == null ? null : Number(o.latitud), lon: o.longitud == null ? null : Number(o.longitud) }))
}
export const buscarOrganismos = async (query: string) => conUsuario(async () => {
  const palabras = sinTildes(query.trim()).split(/\s+/).filter(Boolean)
  if (!palabras.length || query.trim().length < 2) return []
  return (await organismos()).filter(o => { const t = sinTildes(`${o.nombre} ${o.codigo} ${o.distrito ?? ''} ${o.localidad ?? ''}`); return palabras.every(p => t.includes(p)) }).slice(0, 5)
})

// Dirección de la escuela o jefatura de una acción, para el detalle ("a dónde vamos").
export type Ubicacion = { direccion: string | null, localidad: string | null, lat: number | null, lon: number | null }
export const ubicacionDe = async (schoolId: string | null, lugar: string | null) => conUsuario(async (): Promise<Ubicacion | null> => {
  if (schoolId) {
    const { data } = await supabaseServer().from('establecimientos').select('direccion, ciudad, lat, lon').eq('id', schoolId).maybeSingle()
    if (!data) return null
    return { direccion: data.direccion ?? null, localidad: data.ciudad ?? null, lat: data.lat == null ? null : Number(data.lat), lon: data.lon == null ? null : Number(data.lon) }
  }
  const codigo = lugar?.match(/\(([0-9]{4}T[A-Z][0-9]{4})\)/)?.[1]
  const o = codigo ? (await organismos()).find(x => x.codigo === codigo) : null
  return o ? { direccion: o.domicilio, localidad: o.localidad, lat: o.lat, lon: o.lon } : null
})
export const getFedItems = async (fedId: string, from: string, to: string) => conUsuario(() => getFedItemsImpl(fedId, from, to))
export const getAllItems = async (from: string, to: string) => conUsuario(() => getAllItemsImpl(from, to))
export const getEncuentros = async (from: string, to: string) => conUsuario(() => getEncuentrosImpl(from, to))
export const saveItem = async (input: AgendaItemInput, id?: string, alcance: 'uno' | 'siguientes' = 'uno') => conUsuario(yo => saveItemImpl({ ...input, fed_id: yo.fed.id }, id, alcance))
export const setItemStatus = async (id: string, _fedId: string, estado: AgendaItemInput['estado']) => conUsuario(yo => setItemStatusImpl(id, yo.fed.id, estado))
export const deleteItem = async (id: string, _fedId: string, serie = false) => conUsuario(yo => deleteItemImpl(id, yo.fed.id, serie))
export const cambiarEstadoVarias = async (ids: string[], estado: AgendaItemInput['estado']) => conUsuario(yo => cambiarEstadoVariasImpl(ids, yo.fed.id, estado))
export const eliminarVarias = async (ids: string[]) => conUsuario(yo => eliminarVariasImpl(ids, yo.fed.id))
export const moverFinDeSemana = async (ids: string[], destino: 'viernes' | 'lunes') => conUsuario(yo => moverFinDeSemanaImpl(ids, yo.fed.id, destino))
export const getFeriados = async (from: string, to: string) => conUsuario(() => getFeriadosImpl(from, to))

// ---- Eventos DTE: los carga administración; cada FED registra su participación (acción "EVENTO DTE" vinculada).
const EVENTO_COLS = 'id, nombre, fechas, hora_inicio, hora_fin, modalidad, lugar, enlace, descripcion'
const fechaIso = /^\d{4}-\d{2}-\d{2}$/
async function eventosEntre(from: string, to: string): Promise<EventoDte[]> {
  // Son pocos por año: se traen todos y se filtran los que tienen alguna fecha en el rango.
  const { data, error } = await supabaseServer().from('eventos_dte').select(EVENTO_COLS)
  if (error) throw new Error(error.message)
  return ((data ?? []).map(e => ({ ...e, fechas: [...(e.fechas as string[])].sort() })) as EventoDte[])
    .filter(e => e.fechas.some(f => f >= from && f <= to)).sort((a, b) => a.fechas[0].localeCompare(b.fechas[0]))
}
export const getEventos = async (from: string, to: string) => conUsuario(() => eventosEntre(from, to))
export const listarEventos = async (anio: number) => conUsuario(() => eventosEntre(`${anio}-01-01`, `${anio}-12-31`))
export type EventoInput = Omit<EventoDte, 'id'>
export const guardarEvento = async (ev: EventoInput, id?: string) => conUsuario(async yo => {
  if (!yo.esAdmin) throw new Error('Sólo administración puede cargar eventos')
  const fechas = [...new Set(ev.fechas.filter(f => fechaIso.test(f)))].sort()
  if (!opt(ev.nombre) || !fechas.length) throw new Error('Nombre y al menos una fecha son obligatorios')
  if (fechas.length > 10) throw new Error('Un evento puede tener hasta 10 fechas')
  if (!MODALIDADES_EVENTO.includes(ev.modalidad)) throw new Error('Elegí la modalidad')
  const hora = (h: string | null) => (h && /^\d{2}:\d{2}/.test(h) ? h.slice(0, 5) : null)
  const row = { nombre: opt(ev.nombre)!, fechas, hora_inicio: hora(ev.hora_inicio), hora_fin: hora(ev.hora_fin), modalidad: ev.modalidad, lugar: opt(ev.lugar), enlace: opt(ev.enlace), descripcion: opt(ev.descripcion) }
  if (row.enlace && !/^https?:\/\//.test(row.enlace)) throw new Error('El enlace debe empezar con https://')
  const db = supabaseServer()
  const res = id ? await db.from('eventos_dte').update(row).eq('id', id).select('id').single() : await db.from('eventos_dte').insert({ ...row, creado_por: yo.fed.id }).select('id').single()
  if (res.error) throw new Error(res.error.message)
  const eventoId = res.data.id as string
  if (!id) {
    // Aviso a todo el equipo.
    const { data: feds } = await db.from('feds').select('id').neq('id', yo.fed.id)
    const dias = fechas.map(f => `${f.slice(8, 10)}/${f.slice(5, 7)}`).join(' y ')
    if (feds?.length) await db.from('notificaciones').insert(feds.map(f => ({ fed_id: f.id, autor_id: yo.fed.id, tipo: 'evento', evento_id: eventoId, detalle: `${row.nombre} · ${dias} · ${row.modalidad}` })))
  }
  await audit('eventos_dte', eventoId, id ? 'modificacion' : 'alta', yo.fed.id, row)
  return eventoId
})
export const eliminarEvento = async (id: string) => conUsuario(async yo => {
  if (!yo.esAdmin) throw new Error('Sólo administración puede eliminar eventos')
  // Las acciones de participación ya registradas quedan en la agenda de cada uno (sin el vínculo al evento).
  const { error } = await supabaseServer().from('eventos_dte').delete().eq('id', id)
  if (error) throw new Error(error.message)
  await audit('eventos_dte', id, 'baja', yo.fed.id)
})
// Fechas del evento en las que yo ya registré participación.
export const miParticipacion = async (eventoId: string) => conUsuario(async yo => {
  const { data } = await supabaseServer().from('agenda_items').select('fecha').eq('evento_id', eventoId).eq('fed_id', yo.fed.id)
  return (data ?? []).map(d => d.fecha as string)
})
// Registrar participación: una acción "EVENTO DTE" por fecha elegida; realizada si ya pasó, planificada si es futura.
export const registrarParticipacion = async (eventoId: string, fechas: string[]) => conUsuario(async yo => {
  const db = supabaseServer()
  const { data: ev } = await db.from('eventos_dte').select(EVENTO_COLS).eq('id', eventoId).maybeSingle()
  if (!ev) throw new Error('El evento no existe')
  const validas = fechas.filter(f => (ev.fechas as string[]).includes(f))
  const { data: ya } = await db.from('agenda_items').select('fecha').eq('evento_id', eventoId).eq('fed_id', yo.fed.id)
  const nuevas = validas.filter(f => !(ya ?? []).some(x => x.fecha === f))
  if (!nuevas.length) return 0
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
  const { error } = await db.from('agenda_items').insert(nuevas.map(fecha => ({
    fed_id: yo.fed.id, fecha, accion: 'EVENTO DTE', estado: fecha <= hoy ? 'realizada' : 'planificada', evento_id: eventoId,
    hora_inicio: ev.hora_inicio, hora_fin: ev.hora_fin, sub_accion: ev.nombre, modalidad: ev.modalidad,
    lugar: ev.modalidad === 'Virtual' ? 'Virtual' : ev.lugar ?? 'Evento DTE', origen: 'app',
  })))
  if (error) throw new Error(error.code === '23505' ? 'Ya registraste tu participación' : error.message)
  await audit('agenda_items', null, 'alta', yo.fed.id, { evento: eventoId, fechas: nuevas })
  return nuevas.length
})
export const getClubes = async (fedId?: string) => conUsuario(() => getClubesImpl(fedId))
export const setClubCierre = async (id: string, fecha: string | null) => conUsuario(async yo => {
  const { data } = await supabaseServer().from('clubes').select('fed_id').eq('id', id).maybeSingle()
  if (!data || (data.fed_id !== yo.fed.id && !yo.esAdmin)) throw new Error('Sólo quien lleva el club puede finalizarlo o reactivarlo')
  return setClubCierreImpl(id, fecha)
})
export const getNotificaciones = async (_fedId: string) => conUsuario(yo => getNotificacionesImpl(yo.fed.id))
export const marcarLeidas = async (_fedId: string, ids?: string[]) => conUsuario(yo => marcarLeidasImpl(yo.fed.id, ids))
export const responder = async (itemId: string, _fedId: string, respuesta: 'acepta' | 'rechaza') => conUsuario(yo => responderImpl(itemId, yo.fed.id, respuesta))
export const getHistorial = async (itemId: string) => conUsuario(() => getHistorialImpl(itemId))
export const crearClubPorIniciar = async (c: ClubPorIniciarInput) => conUsuario(yo => crearClubPorIniciarImpl({ ...c, fed_id: yo.fed.id }))
export const updateMiPerfil = async (_fedId: string, datos: Pick<Fed, 'distritos_a_cargo' | 'carga_horaria' | 'ddjj'>) => conUsuario(yo => updateMiPerfilImpl(yo.fed.id, datos))
export const addFeriado = async (_autorId: string, f: Omit<Feriado, 'id'>) => conUsuario(yo => addFeriadoImpl(yo.fed.id, f))
export const deleteFeriado = async (_autorId: string, id: string) => conUsuario(yo => deleteFeriadoImpl(yo.fed.id, id))

// ---- Fotos en Google Drive: carpeta propia de cada FED, ordenada por día por la cuenta técnica.
export type EstadoFotos = { configurado: boolean, cuentaTecnica: string, url: string | null, nombre: string | null, puedeEditar: boolean, error: string | null }
export const estadoFotos = async () => conUsuario(async (yo): Promise<EstadoFotos> => {
  const { data } = await supabaseServer().from('feds').select('carpeta_fotos_id, carpeta_fotos_url').eq('id', yo.fed.id).maybeSingle()
  const base = { configurado: driveConfigurado(), cuentaTecnica: cuentaTecnica(), url: data?.carpeta_fotos_url ?? null, nombre: null, puedeEditar: false, error: null }
  if (!data?.carpeta_fotos_id || !base.configurado) return base
  try { const v = await verificarCarpeta(data.carpeta_fotos_id); return { ...base, nombre: v.nombre, puedeEditar: v.puedeEditar } }
  catch (e) { return { ...base, error: e instanceof DriveError && (e.status === 404 || e.status === 403) ? 'La cuenta técnica todavía no tiene acceso a la carpeta. Compartila como Editor.' : errMsgServer(e) } }
})
export const guardarCarpetaFotos = async (url: string) => conUsuario(async yo => {
  const limpio = url.trim()
  if (!limpio) { await supabaseServer().from('feds').update({ carpeta_fotos_id: null, carpeta_fotos_url: null }).eq('id', yo.fed.id); return }
  if (!/^https:\/\/drive\.google\.com\//.test(limpio)) throw new Error('Pegá el enlace de una carpeta de Google Drive (drive.google.com/…)')
  const id = idDeCarpeta(limpio)
  if (!id) throw new Error('No se reconoce el enlace: abrí la carpeta en Drive y copiá la dirección completa')
  const { error } = await supabaseServer().from('feds').update({ carpeta_fotos_id: id, carpeta_fotos_url: urlCarpeta(id) }).eq('id', yo.fed.id)
  if (error) throw new Error(error.message)
  await audit('feds', yo.fed.id, 'modificacion', yo.fed.id, { carpeta_fotos: urlCarpeta(id) })
})
export const ordenarMisFotos = async () => conUsuario(async yo => ordenarFotos(yo.fed.id))

// ---- PVE (Planillas de Visita a Escuelas): el FED sube un PDF por mes a su carpeta; la coordinación las descarga juntas.
export type PveMes = { mes: string, nombreMes: string, vence: string, carpetaUrl: string, entregada: string | null, nombre: string | null, archivoUrl: string | null, enviada: string | null }
const urlArchivo = (id: string) => `https://drive.google.com/file/d/${id}/view`
export const misPve = async (revisar = false) => conUsuario(async (yo): Promise<{ conectada: boolean, meses: PveMes[], error: string | null }> => {
  const db = supabaseServer()
  const { data: fed } = await db.from('feds').select('carpeta_fotos_id').eq('id', yo.fed.id).maybeSingle()
  if (yo.fed.rol !== 'fed' || !fed?.carpeta_fotos_id) return { conectada: false, meses: [], error: null }
  let error: string | null = null
  if (revisar || !(await db.from('pve').select('mes').eq('fed_id', yo.fed.id).eq('mes', inicioMes(hoyPve())).maybeSingle()).data) {
    try { await revisarPve(yo.fed.id) } catch (e) { error = e instanceof Error ? e.message : 'No se pudo revisar la carpeta' }
  }
  const { data } = await db.from('pve').select('mes, folder_id, file_id, nombre, entregada_at, enviada_at').eq('fed_id', yo.fed.id).gte('mes', PRIMER_MES).order('mes', { ascending: false }).limit(6)
  const nl = await noLaborables(inicioMes(hoyPve(), -6), inicioMes(hoyPve(), 2))
  return { conectada: true, error, meses: (data ?? []).map(r => ({ mes: r.mes, nombreMes: nombreMes(r.mes), vence: vencimientoPve(r.mes, nl), carpetaUrl: urlCarpeta(r.folder_id), entregada: r.entregada_at, nombre: r.nombre, archivoUrl: r.file_id ? urlArchivo(r.file_id) : null, enviada: r.enviada_at })) }
})
async function soloCoordinacion() {
  const yo = await requerirUsuario()
  if (yo.fed.rol !== 'coordinacion' && !yo.esAdmin) throw new Error('Sólo la coordinación puede ver las PVE del equipo')
  return yo
}
export type PveFed = { fedId: string, nombre: string, vence: string, conectada: boolean, entregada: string | null, nombreArchivo: string | null, archivoUrl: string | null, enviada: string | null }
export const pveEquipo = async (mes: string) => run(async (): Promise<PveFed[]> => {
  await soloCoordinacion()
  if (!/^\d{4}-\d{2}-01$/.test(mes) || mes < PRIMER_MES) throw new Error('Mes inválido')
  const db = supabaseServer()
  const [{ data: feds }, { data: filas }] = await Promise.all([
    db.from('feds').select('id, nombre_completo, carpeta_fotos_id').eq('rol', 'fed').order('nombre_completo'),
    db.from('pve').select('fed_id, file_id, nombre, entregada_at, enviada_at').eq('mes', mes),
  ])
  const vence = vencimientoPve(mes, await noLaborables(inicioMes(mes, 1), inicioMes(mes, 2)))
  return (feds ?? []).map(f => { const r = (filas ?? []).find(x => x.fed_id === f.id); return { fedId: f.id, nombre: f.nombre_completo, vence, conectada: !!f.carpeta_fotos_id, entregada: r?.file_id ? r.entregada_at : null, nombreArchivo: r?.file_id ? r.nombre : null, archivoUrl: r?.file_id ? urlArchivo(r.file_id) : null, enviada: r?.enviada_at ?? null } })
})
export const marcarPveEnviadas = async (mes: string) => run(async () => {
  const yo = await soloCoordinacion()
  const { data, error } = await supabaseServer().from('pve').update({ enviada_at: new Date().toISOString(), enviada_por: yo.fed.id }).eq('mes', mes).not('file_id', 'is', null).is('enviada_at', null).select('fed_id')
  if (error) throw new Error(error.message)
  await audit('pve', null, 'estado', yo.fed.id, { mes, enviadas: data?.length ?? 0 })
  return data?.length ?? 0
})
// Fotos de una acción: la subcarpeta de la acción si ya tiene fotos asignadas por hora; si no, la carpeta del día.
// Una por cada FED (responsable y participantes) que tenga fotos ordenadas.
export const fotosDelDia = async (fedIds: string[], fecha: string, itemId?: string) => conUsuario(async () => {
  const ids = fedIds.slice(0, 20), db = supabaseServer()
  const [{ data: dias }, { data: acc }] = await Promise.all([
    db.from('fotos_dias').select('fed_id, folder_id').in('fed_id', ids).eq('fecha', fecha),
    itemId ? db.from('fotos_acciones').select('fed_id, folder_id').in('fed_id', ids).eq('item_id', itemId) : Promise.resolve({ data: [] as { fed_id: string, folder_id: string }[] }),
  ])
  const porAccion = new Map((acc ?? []).map(a => [a.fed_id as string, a.folder_id as string]))
  const { data: procesadas } = await db.from('fotos_procesadas').select('fed_id, item_id').in('fed_id', ids).eq('fecha', fecha)
  const cuenta = (id: string, deAccion: boolean) => (procesadas ?? []).filter(p => p.fed_id === id && (!deAccion || p.item_id === itemId)).length
  return ids.flatMap(id => {
    const a = porAccion.get(id), d = (dias ?? []).find(x => x.fed_id === id)?.folder_id as string | undefined
    return a ? [{ fedId: id, url: urlCarpeta(a), deAccion: true, n: cuenta(id, true) }] : d ? [{ fedId: id, url: urlCarpeta(d), deAccion: false, n: cuenta(id, false) }] : []
  })
})

// Cantidad de fotos ordenadas: por acción (asignadas por hora) y por FED y día ("fedId|fecha"). Para los contadores del calendario y el tablero.
export type ConteoFotos = { items: Record<string, number>, dias: Record<string, number> }
export const conteoFotos = async () => conUsuario(async (): Promise<ConteoFotos> => {
  const db = supabaseServer(), out: ConteoFotos = { items: {}, dias: {} }
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await db.from('fotos_procesadas').select('fed_id, fecha, item_id').not('fecha', 'is', null).order('file_id').range(desde, desde + 999)
    if (error) throw new Error(error.message)
    for (const r of data ?? []) {
      const k = `${r.fed_id}|${r.fecha}`
      out.dias[k] = (out.dias[k] ?? 0) + 1
      if (r.item_id) out.items[r.item_id as string] = (out.items[r.item_id as string] ?? 0) + 1
    }
    if (!data || data.length < 1000) return out
  }
})

// ---- Sesión: ingreso, salida y cambio de contraseña.
export type Sesion = { fed: Fed, email: string, esAdmin: boolean, debeCambiar: boolean }
export const miSesion = async () => run(async (): Promise<Sesion | null> => {
  const u = await usuarioActual()
  return u ? { fed: u.fed, email: u.email, esAdmin: u.esAdmin, debeCambiar: u.debeCambiar } : null
})
export const ingresar = async (email: string, password: string) => run(async (): Promise<Sesion> => {
  const correo = email.trim().toLowerCase()
  const invalido = 'Correo o contraseña incorrectos.'
  if (!correo || !password) throw new Error(invalido)
  const { data: fed } = await supabaseServer().from('feds').select('id').eq('email', correo).maybeSingle()
  if (!fed) throw new Error(invalido)
  // Cliente propio para el ingreso: no reutiliza el de servicio (quedaría con la sesión del usuario).
  const { data, error } = await supabaseServer().auth.signInWithPassword({ email: correo, password })
  if (error || !data.session) throw new Error(error?.status === 429 ? 'Demasiados intentos. Esperá unos minutos y probá de nuevo.' : invalido)
  await guardarSesion(data.session)
  const u = await usuarioDeSesion(data.session.access_token)
  if (!u) { await borrarSesion(); throw new Error(invalido) }
  return { fed: u.fed, email: u.email, esAdmin: u.esAdmin, debeCambiar: u.debeCambiar }
})
export const salir = async () => run(async () => { await borrarSesion() })
export const cambiarPassword = async (nueva: string) => run(async () => {
  const yo = await requerirUsuario({ permitirTemporal: true })
  const err = validarPassword(nueva, yo.email)
  if (err) throw new Error(err)
  const db = supabaseServer()
  const { error } = await db.auth.admin.updateUserById(yo.userId, { password: nueva })
  if (error) throw new Error(error.message.includes('same') ? 'La nueva contraseña tiene que ser distinta de la anterior.' : error.message)
  await db.from('feds').update({ debe_cambiar_password: false }).eq('id', yo.fed.id)
  await audit('feds', yo.fed.id, 'modificacion', yo.fed.id, { cambio_password: true })
})

// ---- Usuarios (sólo administración): alta de cuentas y reseteo de contraseñas.
export type UsuarioEquipo = { fedId: string, nombre: string, rol: Fed['rol'], email: string | null, esAdmin: boolean, estado: 'sin_cuenta' | 'pendiente' | 'activo', ultimoIngreso: string | null }
async function cuentasPorEmail() {
  const db = supabaseServer(), m = new Map<string, { id: string, last_sign_in_at?: string | null }>()
  for (let page = 1; page < 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(error.message)
    for (const u of data.users) if (u.email) m.set(u.email.toLowerCase(), { id: u.id, last_sign_in_at: u.last_sign_in_at })
    if (data.users.length < 200) break
  }
  return m
}
async function soloAdmin() { const yo = await requerirUsuario(); if (!yo.esAdmin) throw new Error('Sólo administración puede gestionar usuarios'); return yo }
export const listarUsuarios = async () => run(async (): Promise<UsuarioEquipo[]> => {
  await soloAdmin()
  const [{ data, error }, cuentas] = await Promise.all([supabaseServer().from('feds').select('id, nombre_completo, rol, email, es_admin, debe_cambiar_password').order('nombre_completo'), cuentasPorEmail()])
  if (error) throw new Error(error.message)
  return (data ?? []).map(f => {
    const c = f.email ? cuentas.get(f.email.toLowerCase()) : undefined
    return { fedId: f.id, nombre: f.nombre_completo, rol: f.rol, email: f.email, esAdmin: f.es_admin, estado: !c ? 'sin_cuenta' : f.debe_cambiar_password ? 'pendiente' : 'activo', ultimoIngreso: c?.last_sign_in_at ?? null }
  })
})
// Crea la cuenta (si no existe) o le asigna una contraseña temporal nueva. Devuelve la temporal para entregarla.
export const generarPasswordTemporal = async (fedId: string) => run(async (): Promise<{ email: string, password: string }> => {
  const yo = await soloAdmin()
  const db = supabaseServer()
  const { data: fed } = await db.from('feds').select('id, nombre_completo, email').eq('id', fedId).maybeSingle()
  if (!fed?.email) throw new Error('Ese perfil no tiene correo cargado')
  if (fed.id === yo.fed.id) throw new Error('Tu propia contraseña se cambia desde "Cambiar contraseña"')
  const password = passwordTemporal()
  const existente = (await cuentasPorEmail()).get(fed.email.toLowerCase())
  const res = existente
    ? await db.auth.admin.updateUserById(existente.id, { password })
    : await db.auth.admin.createUser({ email: fed.email.toLowerCase(), password, email_confirm: true, user_metadata: { apellido_nombre: fed.nombre_completo } })
  if (res.error) throw new Error(res.error.message)
  await db.from('feds').update({ debe_cambiar_password: true }).eq('id', fed.id)
  await audit('feds', fed.id, 'modificacion', yo.fed.id, { password_temporal: existente ? 'reseteo' : 'alta' })
  return { email: fed.email, password }
})
