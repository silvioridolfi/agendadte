'use server'

import { supabaseServer } from '@/lib/supabase-server'
import { conRealizadosSinRegistro, proximoEncuentro } from '@/lib/encuentro'
import { esEnero, recesoEnero } from '@/lib/receso'
import { enlaceDe, esReunion } from '@/lib/reunion'
import { ACCIONES, CON_ENCUENTRO, ESTADOS, esAusencia, type AgendaItem, type AgendaItemInput, type Encuentro, type EncuentroInput, type Fed, type Feriado, type School, type Club, type Notificacion, MODALIDADES, MODALIDADES_EVENTO, ROLES_FORMACION, TIPOS_JORNADA, CUE_DTE, esTrayecto, serieFechas } from '@/lib/agenda'
import { requerirUsuario, type Usuario } from '@/lib/sesion'
import { armarDdjj, cargaDeDdjj, cargosDe, franjasDte, validarDdjj } from '@/lib/ddjj'
import { hoyAR } from '@/lib/hora'
import { sinTildes } from '@/lib/buscador'
import { puedeVerAccion, puedeVerAgendaDe, veTodoElEquipo } from '@/lib/permisos'
import type { EntradaComunicado } from '@/lib/comunicados'
import * as comunicados from '@/lib/servidor/comunicados'
import * as sesion from '@/lib/servidor/sesion'
import * as eventos from '@/lib/servidor/eventos'
import type { EventoInput } from '@/lib/servidor/eventos'
import * as rc from '@/lib/servidor/reclamos-cronogramas'
import * as usuarios from '@/lib/servidor/usuarios'
import * as fotos from '@/lib/servidor/fotos-pve'
import { UUID, audit, datosDeAccion, exigirDiasHabiles, fechaCorta, fetchAll, opt, quienEs } from '@/lib/servidor/comun'
import { avisaPorFecha } from '@/lib/avisos'
import type { ClubDeEscuela, DatosEscuela, FichaEscuela, FilaHistorial } from '@/lib/escuela'
import { type EscuelaConectividad } from '@/lib/reclamos'
import { type EstadoReclamo, type Reclamo } from '@/lib/reclamos-registro'
import { DIAS_ATRAS, esDelFed, haceDias, type AvisoCronograma, type Cronograma, type EstadoSeguimiento } from '@/lib/cronogramas'
import { armarResumen, contarAccesos, type Accesos, type ContactoEscuela, type ResumenEscuela } from '@/lib/mis-escuelas'
import { estadoAlCrear } from '@/lib/estado'
import { COLS_ORGANISMO, cambiosDeOrganismo, type Jefatura, type JefaturaResumen, type ValoresOrganismo } from '@/lib/organismos'
import type { PuntoMapa, PuntosMapa } from '@/lib/mapa'
import { gruposPorPredio, hermanasDe } from '@/lib/predio'
import { resumenProximos } from '@/lib/cruce'
import { CLAVES_CONECTIVIDAD, COLS_EDITABLES, ORIGEN_OPCIONES, cambiosDeEscuela, historialDeContacto, nivelEdicion, resumenContacto, seccionDe, validarContacto, type ContactoEditable, type ContactoInput, type EdicionEscuela, type NivelEdicion, type OpcionesEscuela, type ValoresEscuela } from '@/lib/escuelas-edicion'
import { avisosPendientes, diasSinActividad, fechaAR, hayAlerta, type Actividad, type AvisoPrevio } from '@/lib/actividad'

// En producción Next oculta el mensaje de los errores lanzados en server actions (React #441),
// así que se devuelven como valor y el cliente los vuelve a lanzar con el mensaje real.
export type Result<T> = { ok: true; data: T } | { ok: false; error: string }
async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try { return { ok: true, data: await fn() } } catch (e) { return { ok: false, error: e instanceof Error ? e.message : String(e) } }
}

const SCHOOL_COLS = 'id, cue, nombre, distrito, ciudad'

async function getFedsImpl(): Promise<Fed[]> {
  const { data, error } = await supabaseServer().from('feds').select('id, nombre_completo, distritos_a_cargo, carga_horaria, ddjj, rol, carpeta_fotos_url').order('nombre_completo')
  if (error) throw new Error(error.message)
  return data ?? []
}

// Todas las escuelas con predio, agrupadas por número: para mostrar con quién comparten edificio.
const predioValidoServidor = (p: unknown) => (typeof p === 'number' && p > 0 ? p : null)
async function gruposDePredio(db: ReturnType<typeof supabaseServer>) {
  return gruposPorPredio(await fetchAll<{ id: string, cue: number | null, nombre: string | null, predio: number | null }>((a, b) => db.from('establecimientos').select('id, cue, nombre, predio').not('predio', 'is', null).order('id').range(a, b)))
}

async function searchSchoolsImpl(query: string): Promise<School[]> {
  const q = query.trim()
  if (q.length < 2) return []
  // Sin tildes, todas las palabras (nombre/ciudad) o prefijo de CUE: ver search_establecimientos en supabase/migrations.
  const db = supabaseServer()
  const { data, error } = await db.rpc('search_establecimientos', { q, max_results: 15 })
  if (error) throw new Error(error.message)
  const escuelas = (data ?? []) as School[]
  if (!escuelas.length) return []
  // Cada resultado indica si comparte predio con otras escuelas.
  const [predios, grupos] = await Promise.all([
    db.from('establecimientos').select('id, predio').in('id', escuelas.map(e => e.id)),
    gruposDePredio(db),
  ])
  const predioDe = new Map((predios.data ?? []).map(r => [r.id as string, r.predio as number | null]))
  const proximos = await rc.proximosPorEscuela(db, escuelas.map(e => e.id))
  return escuelas.map(e => ({ ...e, predio: predioDe.get(e.id) ?? null, comparte: hermanasDe(grupos, e.id, predioDe.get(e.id)), crono: resumenProximos(proximos.get(e.id) ?? []) }))
}

// Ficha de una escuela. Todos ven el historial de la escuela; el detalle de cada acción sólo llega para quien participó o es de coordinación.
const COLS_ESCUELA = `id, cue, nombre, alias, distrito, ciudad, direccion, lat, lon, predio, nivel, modalidad, ambito, turnos, matricula, varones, mujeres, secciones, fed_a_cargo, ${CLAVES_CONECTIVIDAD.join(', ')}`
async function getFichaEscuelaImpl(yo: Usuario, id: string): Promise<FichaEscuela> {
  if (!UUID.test(id)) throw new Error('Escuela inválida')
  const db = supabaseServer()
  const [e, its, cls] = await Promise.all([
    db.from('establecimientos').select(COLS_ESCUELA).eq('id', id).maybeSingle(),
    db.from('agenda_items').select(ITEM_COLS).eq('school_id', id).neq('estado', 'cancelada').order('fecha', { ascending: false }).limit(400),
    db.from('clubes').select('id, tipo, grupo, propuesta, fed_id, fecha_inicio, fecha_cierre, cohorte, school_id, encuentros:agenda_encuentros(id, item:agenda_items(estado))').or(`school_id.eq.${id},escuela_origen_id.eq.${id}`),
  ])
  if (e.error) throw new Error(e.error.message)
  if (its.error) throw new Error(its.error.message)
  if (cls.error) throw new Error(cls.error.message)
  if (!e.data) throw new Error('No se encontró la escuela')
  const { lat, lon, ...completo } = e.data as unknown as Record<string, unknown> & { lat: number | null, lon: number | null, direccion: string | null, ciudad: string | null }
  // La conectividad se muestra aparte y la ven todos; el resto son los datos de la escuela.
  const conectividad = Object.fromEntries(CLAVES_CONECTIVIDAD.map(k => [k, completo[k] == null || String(completo[k]).trim() === '' ? null : String(completo[k]).trim()]))
  const resto = Object.fromEntries(Object.entries(completo).filter(([k]) => !CLAVES_CONECTIVIDAD.includes(k))) as typeof completo
  const texto = resto.direccion ? `${resto.direccion}${resto.ciudad ? `, ${resto.ciudad}` : ''}, Buenos Aires, Argentina` : null
  const grupos = await gruposDePredio(db)
  const escuela = { ...resto, lat, lon, predio: predioValidoServidor(resto.predio), comparte: hermanasDe(grupos, id, resto.predio as number | null), mapa: lat != null && lon != null ? `${lat},${lon}` : texto } as unknown as DatosEscuela
  const jefatura = await jefaturaDe(db, escuela.distrito)
  const contactos = await contactosDe(db, escuela.cue)
  const proximos = (await rc.proximosPorEscuela(db, [id])).get(id) ?? []
  const todo = yo.fed.rol === 'coordinacion'
  const historial: FilaHistorial[] = ((its.data ?? []) as unknown as AgendaItem[]).filter(i => !esAusencia(i.accion)).map(i => {
    const propia = i.fed_id === yo.fed.id || (i.participantes ?? []).some(p => p.fed_id === yo.fed.id)
    return { id: i.id, fed_id: i.fed_id, fecha: i.fecha, hora_inicio: i.hora_inicio, accion: i.accion, sub_accion: i.sub_accion, estado: i.estado, propia, ...(propia || todo ? { item: i } : {}) }
  })
  const clubes: ClubDeEscuela[] = ((cls.data ?? []) as unknown as (Omit<ClubDeEscuela, 'realizados' | 'esOrigen'> & { school_id: string | null, encuentros: { item: { estado: string } | { estado: string }[] | null }[] })[]).map(({ encuentros, school_id, ...c }) => ({
    ...c, esOrigen: school_id !== id, realizados: encuentros.filter(x => [x.item].flat().some(it => it?.estado === 'realizada')).length,
  }))
  return { escuela, jefatura, contactos, proximos, conectividad, historial, clubes, puedeEditar: nivelEdicion({ esAdmin: yo.esAdmin, rol: yo.fed.rol, nombre: yo.fed.nombre_completo }, escuela.fed_a_cargo) !== null }
}

// Contactos de la escuela con algún dato, el principal primero. Los ven todos.
async function contactosDe(db: ReturnType<typeof supabaseServer>, cue: number | null): Promise<ContactoEscuela[]> {
  if (cue == null) return []
  const { data, error } = await db.from('contactos').select('nombre, apellido, cargo, telefono, correo, correo_laboral, es_principal').eq('cue', cue).order('es_principal', { ascending: false }).order('apellido')
  if (error) throw new Error(error.message)
  return ((data ?? []) as ContactoEscuela[]).filter(c => [c.nombre, c.apellido, c.telefono, c.correo, c.correo_laboral].some(v => v && v.trim()))
}

// Jefatura distrital del distrito de la escuela (si hay).
async function jefaturaDe(db: ReturnType<typeof supabaseServer>, distrito: string | null): Promise<JefaturaResumen | null> {
  if (!distrito) return null
  const { data } = await db.from('organismos_descentralizados').select('id, nombre, telefono, email').eq('subtipo_organizacion', 'Jefatura Distrital').eq('distrito', distrito).limit(1).maybeSingle()
  return data ? { id: data.id as string, nombre: data.nombre as string, telefono: (data.telefono as string | null) ?? null, email: (data.email as string | null) ?? null } : null
}

// Lo que la base sabe de la conectividad de una escuela (enlace, piso y proveedores): para armar reclamos de conectividad.
async function getConectividadEscuelaImpl(id: string): Promise<EscuelaConectividad> {
  if (!UUID.test(id)) throw new Error('Escuela inválida')
  const { data, error } = await supabaseServer().from('establecimientos').select('id, cue, nombre, distrito, ciudad, direccion, matricula, plan_enlace, subplan_enlace, plan_piso_tecnologico, tipo_piso_instalado, tipo, proveedor_internet_pnce, proveedor_asignado_pba, reclamos_grupo_1_ani, recurso_primario, access_id').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No se encontró la escuela')
  const t = (v: unknown) => (v == null || String(v).trim() === '' ? null : String(v).trim())
  return { id: data.id as string, cue: (data.cue as number | null) ?? null, nombre: t(data.nombre), distrito: t(data.distrito), ciudad: t(data.ciudad), direccion: t(data.direccion), matricula: data.matricula == null ? null : Number(data.matricula),
    plan_enlace: t(data.plan_enlace), subplan_enlace: t(data.subplan_enlace), plan_piso_tecnologico: t(data.plan_piso_tecnologico), tipo_piso_instalado: t(data.tipo_piso_instalado), tipo: t(data.tipo),
    proveedor_pnce: t(data.proveedor_internet_pnce), proveedor_pba: t(data.proveedor_asignado_pba), ani: t(data.reclamos_grupo_1_ani), recurso_primario: t(data.recurso_primario), access_id: t(data.access_id) }
}

// ---- Mis escuelas: las escuelas que tiene a cargo cada FED (establecimientos.fed_a_cargo). La coordinación y la administración ven todas.
async function getMisEscuelasImpl(yo: Usuario): Promise<ResumenEscuela[]> {
  const db = supabaseServer(), hoy = hoyAR()
  const todos = yo.esAdmin || yo.fed.rol === 'coordinacion'
  const filas = (await fetchAll<Pick<ResumenEscuela, 'id' | 'cue' | 'nombre' | 'distrito' | 'ciudad' | 'nivel' | 'modalidad' | 'fed_a_cargo' | 'direccion'> & { predio: number | null }>((a, b) => db.from('establecimientos').select('id, cue, nombre, distrito, ciudad, nivel, modalidad, fed_a_cargo, direccion, predio').order('nombre').order('id').range(a, b)))
    .filter(e => todos || esDelFed(e.fed_a_cargo, yo.fed.nombre_completo))
  const cues = new Set(filas.map(e => e.cue).filter((c): c is number => c != null))
  const [contactos, cronogramas, reclamos, acciones] = await Promise.all([
    fetchAll<ContactoEscuela & { cue: number | null }>((a, b) => db.from('contactos').select('cue, nombre, apellido, cargo, telefono, correo, correo_laboral, es_principal').order('id').range(a, b)).then(l => l.filter(c => c.cue != null && cues.has(c.cue))),
    fetchAll<{ school_id: string | null, fecha_inicio: string, fecha_fin: string, tipo: string | null }>((a, b) => db.from('cronogramas').select('school_id, fecha_inicio, fecha_fin, tipo').eq('en_planilla', true).gte('fecha_fin', hoy).order('id').range(a, b)),
    fetchAll<{ school_id: string | null }>((a, b) => db.from('reclamos_conectividad').select('school_id').in('estado', ['enviado', 'en_proceso']).order('id').range(a, b)),
    fetchAll<{ school_id: string | null, fecha: string, estado: string }>((a, b) => db.from('agenda_items').select('school_id, fecha, estado').not('school_id', 'is', null).in('estado', ['realizada', 'planificada']).order('id').range(a, b)),
  ])
  return armarResumen(filas, { grupos: await gruposDePredio(db), contactos, cronogramas, reclamos, acciones }, hoy)
}
// Números de los accesos rápidos del Tablero: las escuelas del FED (el CED, todas) con sus reclamos abiertos y cronogramas próximos.
async function getAccesosImpl(yo: Usuario): Promise<Accesos> {
  const db = supabaseServer(), hoy = hoyAR()
  const todas = yo.fed.rol === 'coordinacion'
  const escuelas = (await fetchAll<{ id: string, fed_a_cargo: string | null }>((a, b) => db.from('establecimientos').select('id, fed_a_cargo').order('id').range(a, b)))
    .filter(e => todas || esDelFed(e.fed_a_cargo, yo.fed.nombre_completo))
  const [reclamosAbiertos, cronogramasProximos] = await Promise.all([
    fetchAll<{ school_id: string | null, fed_id: string | null }>((a, b) => db.from('reclamos_conectividad').select('school_id, fed_id').in('estado', ['enviado', 'en_proceso']).order('id').range(a, b)),
    fetchAll<{ school_id: string | null }>((a, b) => db.from('cronogramas').select('school_id').eq('en_planilla', true).gte('fecha_fin', hoy).order('id').range(a, b)),
  ])
  return contarAccesos({ escuelaIds: new Set(escuelas.map(e => e.id)), todas, miId: yo.fed.id, reclamosAbiertos, cronogramasProximos })
}
// Lo que se suma a la ficha de una escuela a cargo: reclamos y cronogramas. Sólo para el FED a cargo, la coordinación y la administración.
export type ExtrasEscuela = { reclamos: Reclamo[], cronogramas: Cronograma[] }
async function getExtrasEscuelaImpl(yo: Usuario, id: string): Promise<ExtrasEscuela> {
  if (!UUID.test(id)) throw new Error('Escuela inválida')
  const db = supabaseServer()
  const { data: e, error } = await db.from('establecimientos').select('fed_a_cargo').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  if (!e) throw new Error('No se encontró la escuela')
  if (!yo.esAdmin && yo.fed.rol !== 'coordinacion' && !esDelFed(e.fed_a_cargo as string | null, yo.fed.nombre_completo)) throw new Error('Estos datos los ve el FED a cargo de la escuela')
  const [rec, cro] = await Promise.all([
    db.from('reclamos_conectividad').select(rc.COLS_RECLAMO).eq('school_id', id).order('enviado_at', { ascending: false }).limit(20),
    db.from('cronogramas').select(rc.COLS_CRONOGRAMA).eq('school_id', id).eq('en_planilla', true).gte('fecha_fin', haceDias(hoyAR(), DIAS_ATRAS)).order('fecha_inicio'),
  ])
  if (rec.error) throw new Error(rec.error.message)
  if (cro.error) throw new Error(cro.error.message)
  return { reclamos: (rec.data ?? []) as unknown as Reclamo[], cronogramas: await rc.conHistorial((cro.data ?? []) as unknown as Omit<Cronograma, 'historial'>[]) }
}
// ── Edición de los datos de una escuela ──
// El FED a cargo edita los datos del día a día y los contactos; el CED y la administración, todo. Cada cambio queda en historial_cambios con su autor. No se avisa a nadie.
const COLS_CONTACTO_EDITABLE = 'id, nombre, apellido, cargo, telefono, correo, correo_laboral, es_principal'
async function escuelaEditable(yo: Usuario, id: string) {
  if (!UUID.test(id)) throw new Error('Escuela inválida')
  const db = supabaseServer()
  const { data, error } = await db.from('establecimientos').select([...new Set(['id', 'cue', 'fed_a_cargo', ...COLS_EDITABLES.split(', ')])].join(', ')).eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No se encontró la escuela')
  const e = data as unknown as ValoresEscuela & { id: string, cue: number | null, nombre: string | null, fed_a_cargo: string | null }
  const nivel = nivelEdicion({ esAdmin: yo.esAdmin, rol: yo.fed.rol, nombre: yo.fed.nombre_completo }, e.fed_a_cargo)
  if (!nivel) throw new Error('Sólo el FED a cargo de la escuela, el CED o la administración pueden editarla')
  return { db, e, nivel }
}
const unicosOrdenados = (l: (string | null | undefined)[]) => [...new Set(l.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, 'es'))
async function opcionesEscuela(db: ReturnType<typeof supabaseServer>): Promise<OpcionesEscuela> {
  const columnas = [...new Set(Object.values(ORIGEN_OPCIONES).flat())]
  const [filas, feds] = await Promise.all([
    fetchAll<Record<string, string | null>>((a, b) => db.from('establecimientos').select(`id, ${columnas.join(', ')}`).order('id').range(a, b)),
    db.from('feds').select('nombre_completo').eq('rol', 'fed'),
  ])
  const opciones: OpcionesEscuela = Object.fromEntries(Object.entries(ORIGEN_OPCIONES).map(([clave, cols]) => [clave, unicosOrdenados(filas.flatMap(f => cols.map(c => f[c]?.trim())))]))
  opciones.fed_a_cargo = unicosOrdenados((feds.data ?? []).map(f => f.nombre_completo as string))
  return opciones
}
async function anotarCambios(db: ReturnType<typeof supabaseServer>, escuelaId: string, autorId: string, filas: { seccion: string, campo: string, valor_anterior: string | null, valor_nuevo: string | null }[]) {
  if (!filas.length) return
  const { error } = await db.from('historial_cambios').insert(filas.map(f => ({ ...f, establecimiento_id: escuelaId, autor_id: autorId })))
  if (error) throw new Error(error.message)
}
async function getEdicionEscuelaImpl(yo: Usuario, id: string): Promise<EdicionEscuela> {
  const { db, e, nivel } = await escuelaEditable(yo, id)
  const [con, his, feds, opciones] = await Promise.all([
    e.cue == null ? Promise.resolve({ data: [], error: null }) : db.from('contactos').select(COLS_CONTACTO_EDITABLE).eq('cue', e.cue).order('es_principal', { ascending: false }).order('apellido'),
    db.from('historial_cambios').select('id, seccion, campo, valor_anterior, valor_nuevo, created_at, autor_id').eq('establecimiento_id', id).order('created_at', { ascending: false }).limit(60),
    db.from('feds').select('id, nombre_completo'),
    opcionesEscuela(db),
  ])
  if (con.error) throw new Error(con.error.message)
  if (his.error) throw new Error(his.error.message)
  const autor = (a: string | null) => (a ? (feds.data ?? []).find(f => f.id === a)?.nombre_completo as string | undefined ?? 'Ex integrante' : null)
  const { id: _id, cue, ...valores } = e
  return {
    id, cue, nombre: e.nombre, nivel, valores, opciones,
    contactos: (con.data ?? []) as unknown as ContactoEditable[],
    historial: (his.data ?? []).map(h => ({ id: h.id as string, seccion: h.seccion as string, campo: h.campo as string, valor_anterior: h.valor_anterior as string | null, valor_nuevo: h.valor_nuevo as string | null, created_at: h.created_at as string, autor: autor(h.autor_id as string | null) })),
  }
}
// Guarda sólo lo que cambió. Devuelve cuántos datos se modificaron.
async function guardarEscuelaImpl(yo: Usuario, id: string, cambios: Record<string, unknown>): Promise<number> {
  const { db, e, nivel } = await escuelaEditable(yo, id)
  const lista = cambiosDeEscuela(e, cambios, nivel as NivelEdicion, await opcionesEscuela(db))
  if (!lista.length) return 0
  const { error } = await db.from('establecimientos').update(Object.fromEntries(lista.map(c => [c.clave, c.valor]))).eq('id', id)
  if (error) throw new Error(error.message)
  await anotarCambios(db, id, yo.fed.id, lista.map(c => ({ seccion: seccionDe(c.clave), campo: c.label, valor_anterior: c.anterior, valor_nuevo: c.nuevo })))
  return lista.length
}
async function contactoDe(db: ReturnType<typeof supabaseServer>, cue: number | null, contactoId: string) {
  if (!UUID.test(contactoId)) throw new Error('Contacto inválido')
  const { data, error } = await db.from('contactos').select(COLS_CONTACTO_EDITABLE).eq('id', contactoId).eq('cue', cue ?? -1).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No se encontró el contacto en esta escuela')
  return data as unknown as ContactoEditable
}
// Alta (sin contactoId) o edición de un contacto de la escuela.
async function guardarContactoImpl(yo: Usuario, id: string, contactoId: string | null, input: ContactoInput): Promise<void> {
  const { db, e } = await escuelaEditable(yo, id)
  if (e.cue == null) throw new Error('La escuela no tiene CUE')
  const nuevo = validarContacto(input)
  if (!contactoId) {
    const { error } = await db.from('contactos').insert({ ...nuevo, cue: e.cue, distrito: e.distrito, fed_a_cargo: e.fed_a_cargo, es_principal: false })
    if (error) throw new Error(error.message)
    await anotarCambios(db, id, yo.fed.id, [{ seccion: 'Contacto', campo: 'Contacto agregado', valor_anterior: null, valor_nuevo: resumenContacto(nuevo) }])
    return
  }
  const antes = await contactoDe(db, e.cue, contactoId)
  const filas = historialDeContacto(antes, nuevo)
  if (!filas.length) return
  const { error } = await db.from('contactos').update(nuevo).eq('id', contactoId)
  if (error) throw new Error(error.message)
  await anotarCambios(db, id, yo.fed.id, filas)
}
async function borrarContactoImpl(yo: Usuario, id: string, contactoId: string): Promise<void> {
  const { db, e } = await escuelaEditable(yo, id)
  const antes = await contactoDe(db, e.cue, contactoId)
  const { error } = await db.from('contactos').delete().eq('id', contactoId)
  if (error) throw new Error(error.message)
  await anotarCambios(db, id, yo.fed.id, [{ seccion: 'Contacto', campo: 'Contacto eliminado', valor_anterior: resumenContacto(antes), valor_nuevo: null }])
}
// El contacto principal es el que se muestra primero en los listados: queda uno solo por escuela.
async function principalContactoImpl(yo: Usuario, id: string, contactoId: string): Promise<void> {
  const { db, e } = await escuelaEditable(yo, id)
  const c = await contactoDe(db, e.cue, contactoId)
  if (c.es_principal) return
  const sacar = await db.from('contactos').update({ es_principal: false }).eq('cue', e.cue as number).eq('es_principal', true)
  if (sacar.error) throw new Error(sacar.error.message)
  const poner = await db.from('contactos').update({ es_principal: true }).eq('id', contactoId)
  if (poner.error) throw new Error(poner.error.message)
  await anotarCambios(db, id, yo.fed.id, [{ seccion: 'Contacto', campo: 'Contacto principal', valor_anterior: null, valor_nuevo: resumenContacto(c) }])
}
// ── Mapa y jefaturas ──
// Todas las escuelas con ubicación (más las jefaturas) para el mapa; las que todavía no la tienen van aparte. Lo ven todos los FED y el CED.
async function getPuntosMapaImpl(): Promise<PuntosMapa> {
  const db = supabaseServer()
  const [escuelas, orgs] = await Promise.all([
    fetchAll<{ id: string, cue: number | null, nombre: string | null, distrito: string | null, ciudad: string | null, direccion: string | null, lat: number | null, lon: number | null, fed_a_cargo: string | null, nivel: string | null, predio: number | null }>((a, b) => db.from('establecimientos').select('id, cue, nombre, distrito, ciudad, direccion, lat, lon, fed_a_cargo, nivel, predio').order('id').range(a, b)),
    db.from('organismos_descentralizados').select('id, nombre, distrito, domicilio, localidad, latitud, longitud').order('nombre'),
  ])
  if (orgs.error) throw new Error(orgs.error.message)
  const puntos: PuntoMapa[] = [], sinUbicacion: PuntosMapa['sinUbicacion'] = []
  const proximos = await rc.proximosPorEscuela(db, null)
  for (const e of escuelas) {
    if (e.lat != null && e.lon != null) puntos.push({ id: e.id, tipo: 'escuela', nombre: e.nombre ?? `CUE ${e.cue ?? ''}`, lat: Number(e.lat), lon: Number(e.lon), cue: e.cue, distrito: e.distrito, direccion: [e.direccion, e.ciudad].filter(Boolean).join(', ') || null, fed: e.fed_a_cargo, nivel: e.nivel, predio: predioValidoServidor(e.predio), crono: resumenProximos(proximos.get(e.id) ?? []) })
    else sinUbicacion.push({ id: e.id, cue: e.cue, nombre: e.nombre ?? `CUE ${e.cue ?? ''}`, distrito: e.distrito, fed: e.fed_a_cargo, predio: predioValidoServidor(e.predio) })
  }
  for (const o of orgs.data ?? []) if (o.latitud != null && o.longitud != null) puntos.push({ id: o.id as string, tipo: 'jefatura', nombre: o.nombre as string, lat: Number(o.latitud), lon: Number(o.longitud), cue: null, distrito: o.distrito as string | null, direccion: [o.domicilio, o.localidad].filter(Boolean).join(', ') || null, fed: null, nivel: null, predio: null, crono: null })
  return { puntos, sinUbicacion }
}
async function getJefaturaImpl(yo: Usuario, id: string): Promise<Jefatura> {
  if (!UUID.test(id)) throw new Error('Jefatura inválida')
  const { data, error } = await supabaseServer().from('organismos_descentralizados').select(`id, codigo, nombre, subtipo_organizacion, distrito, ${COLS_ORGANISMO}`).eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No se encontró la jefatura')
  const d = data as unknown as Record<string, string | number | null>
  const valores: ValoresOrganismo = Object.fromEntries(COLS_ORGANISMO.split(', ').map(k => [k, d[k] ?? null]))
  return { id, codigo: d.codigo as string, nombre: d.nombre as string, subtipo: d.subtipo_organizacion as string | null, distrito: d.distrito as string | null, valores, puedeEditar: yo.esAdmin || yo.fed.rol === 'coordinacion' }
}
// Sólo el CED y la administración. Queda anotado en la auditoría; no se avisa a nadie.
async function guardarJefaturaImpl(yo: Usuario, id: string, cambios: Record<string, unknown>): Promise<number> {
  if (!yo.esAdmin && yo.fed.rol !== 'coordinacion') throw new Error('Sólo el CED o la administración pueden editar una jefatura')
  const actual = await getJefaturaImpl(yo, id)
  const lista = cambiosDeOrganismo(actual.valores, cambios)
  if (!lista.length) return 0
  const db = supabaseServer()
  const { error } = await db.from('organismos_descentralizados').update({ ...Object.fromEntries(lista.map(c => [c.clave, c.valor])), updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(error.message)
  await db.from('auditoria').insert({ tabla: 'organismos_descentralizados', registro_id: id, operacion: 'update', autor_id: yo.fed.id, datos: { cambios: lista.map(c => ({ campo: c.label, antes: c.anterior, despues: c.nuevo })) } })
  return lista.length
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

// Disponibilidad de compañeros en una fecha: sus acciones de ese día (propias o en las que participan), sin cancelar.
// A un FED sólo le llega el tipo y el horario; la coordinación ve además la escuela o el lugar.
export type Ocupacion = { fed_id: string, accion: AgendaItem['accion'], hora_inicio: string | null, hora_fin: string | null, lugar: string | null }
async function disponibilidadImpl(yo: Usuario, fecha: string, ids: string[], excluir?: string): Promise<Ocupacion[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !ids.length) return []
  const db = supabaseServer(), verLugar = yo.fed.rol === 'coordinacion' || yo.esAdmin
  const cols = 'id, fed_id, accion, hora_inicio, hora_fin, estado, lugar, school:establecimientos(nombre)'
  const [propias, compartidas] = await Promise.all([
    db.from('agenda_items').select(cols).eq('fecha', fecha).in('fed_id', ids.slice(0, 50)).neq('estado', 'cancelada'),
    db.from('agenda_participantes').select(`fed_id, item:agenda_items!inner(${cols})`).in('fed_id', ids.slice(0, 50)).eq('item.fecha', fecha).neq('item.estado', 'cancelada'),
  ])
  type Fila = { id: string, fed_id: string, accion: AgendaItem['accion'], hora_inicio: string | null, hora_fin: string | null, lugar: string | null, school: { nombre: string | null } | null }
  const out: Ocupacion[] = []
  const sumar = (fedId: string, i: Fila) => { if (i.id !== excluir) out.push({ fed_id: fedId, accion: i.accion, hora_inicio: i.hora_inicio, hora_fin: i.hora_fin, lugar: verLugar ? i.school?.nombre ?? i.lugar : null }) }
  for (const i of (propias.data ?? []) as unknown as Fila[]) sumar(i.fed_id, i)
  for (const p of (compartidas.data ?? []) as unknown as { fed_id: string, item: Fila }[]) if (p.item) sumar(p.fed_id, p.item)
  return out
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

const num = (v: number | null | undefined) => (v == null || Number.isNaN(v) ? null : Math.max(0, Math.round(v)))

function clean(input: AgendaItemInput) {
  if (!input.fed_id || !/^\d{4}-\d{2}-\d{2}$/.test(input.fecha)) throw new Error('FED y fecha son obligatorios')
  if (!ACCIONES.includes(input.accion) || !ESTADOS.includes(input.estado)) throw new Error('Acción o estado inválido')
  const { encuentro: _encuentro, participantes: _participantes, repeticion: _repeticion, ...row } = input
  // Modalidad: formación interna, eventos DTE y reuniones (las virtuales o híbridas pueden llevar el enlace de la videollamada).
  const modalidad = (input.accion === 'FORMACIÓN INTERNA' || input.accion === 'EVENTO DTE' || esReunion(input.accion)) && input.modalidad && MODALIDADES_EVENTO.includes(input.modalidad) ? input.modalidad : null
  return {
    ...row, school_id: opt(input.school_id), hora_inicio: opt(input.hora_inicio), hora_fin: opt(input.hora_fin), sub_accion: opt(input.sub_accion),
    detalle: opt(input.detalle), cantidad: num(input.cantidad), lugar: opt(input.lugar),
    // Datos propios de la formación interna (en otras acciones quedan vacíos).
    modalidad, enlace: enlaceDe(input.accion, modalidad, input.enlace),
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

// Historial de cambios (quién hizo qué y cuándo). No interrumpe la operación si falla.

// Aviso a los compañeros etiquetados (sin quien hizo el cambio).
// Las acciones de fechas pasadas (carga retroactiva) no avisan: la agenda se acomoda al final del mes y no hay nada que anticipar.
async function avisarParticipantes(itemId: string, autorId: string, tipo: 'modificacion' | 'cancelacion', detalle: string, conItem = true) {
  const db = supabaseServer()
  const { data: it } = await db.from('agenda_items').select('fecha').eq('id', itemId).maybeSingle()
  if (it && !avisaPorFecha(it.fecha as string, hoyAR())) return
  const { data } = await db.from('agenda_participantes').select('fed_id').eq('item_id', itemId)
  const destinos = (data ?? []).map(p => p.fed_id as string).filter(f => f !== autorId)
  if (destinos.length) await db.from('notificaciones').insert(destinos.map(fed_id => ({ fed_id, item_id: conItem ? itemId : null, autor_id: autorId, tipo, detalle })))
}

// `avisar`: si se notifica a los compañeros etiquetados (en una visita con varias acciones, sólo la primera avisa).
async function saveItemImpl(input: AgendaItemInput, id?: string, alcance: 'uno' | 'siguientes' = 'uno', avisar = true): Promise<{ id: string, creadas: number }> {
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
  // Al editar sin cambiar la fecha se respeta lo ya cargado (acciones previas a esta regla).
  if (!antes || antes.fecha !== row.fecha) await exigirDiasHabiles([row.fecha])
  // Una reprogramada que recibe fecha nueva vuelve a planificada: la etiqueta marca sólo lo pendiente de fecha.
  if (antes && antes.estado === 'reprogramada' && row.estado === 'reprogramada' && antes.fecha !== row.fecha) row.estado = 'planificada'
  // Acción nueva con fecha pasada: se registra como realizada (carga retroactiva de lo ya hecho).
  // Además, un paro (adhesión) no queda pendiente: se registra directamente como realizado, sin importar la fecha. Se puede editar después.
  if (!id) row.estado = estadoAlCrear({ accion: row.accion, fecha: row.fecha, hoy: hoyAR(), estado: row.estado })
  // Club o práctica que ya vino de la planilla (CAPACITACIONES): no se duplica el encuentro.
  if (esTrayecto(row.accion) && (!antes || antes.fecha !== row.fecha || antes.school_id !== row.school_id)) {
    let q = db.from('agenda_encuentros').select('id').eq('fed_id', row.fed_id).eq('fecha', row.fecha).eq('tipo', row.accion).eq('origen', 'planilla').is('agenda_item_id', null).limit(1)
    q = row.school_id ? q.eq('school_id', row.school_id) : q.eq('lugar', row.lugar ?? '')
    if ((await q).data?.length) throw new Error('Este encuentro ya está registrado desde la planilla (pestaña CAPACITACIONES) y ya cuenta en las métricas. No hace falta cargarlo de nuevo.')
  }
  const rowSinSerie = row
  // Al editar, el item debe pertenecer al FED que lo edita.
  const res = id ? await db.from('agenda_items').update(rowSinSerie).eq('id', id).eq('fed_id', row.fed_id).select('id').single()
    : await db.from('agenda_items').insert(rowSinSerie).select('id').single()
  if (res.error) throw new Error(res.error.message)
  const itemId = res.data.id as string
  const cambiosPart = input.participantes ? await syncParticipantes(itemId, row.fed_id, input.participantes, avisar && avisaPorFecha(row.fecha, hoyAR())) : { sumar: [], quitar: [] }

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

  // Cambios en una acción compartida: se avisa a los compañeros (en una visita, sólo desde la primera acción).
  if (antes && avisar) {
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
      const copia = { ...rowSinSerie, estado: row.accion === 'LICENCIA' ? row.estado : 'planificada' as const, serie_id: serieId, club_id: clubId }
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
  // Licencia nueva: la coordinación recibe un solo aviso con el período completo.
  if (!id && row.accion === 'LICENCIA') {
    const { data: coord } = await db.from('feds').select('id').eq('rol', 'coordinacion').neq('id', row.fed_id)
    const hasta = input.repeticion?.hasta && creadas > 1 ? input.repeticion.hasta : null
    const detalle = `${hasta ? `Del ${fechaCorta(row.fecha)} al ${fechaCorta(hasta)}` : `El ${fechaCorta(row.fecha)}`} · ${creadas} ${creadas === 1 ? 'día hábil' : 'días hábiles'}`
    if (coord?.length) await db.from('notificaciones').insert(coord.map(c => ({ fed_id: c.id as string, item_id: itemId, autor_id: row.fed_id, tipo: 'etiqueta', detalle })))
  }
  // Edición de una serie: "este y los siguientes" aplica horario, club/grupo y datos de la propuesta a las fechas planificadas que siguen
  // y los acompañantes sumados o quitados (no cambia la fecha de cada una ni los datos de participación, que son propios de cada encuentro).
  if (id && alcance === 'siguientes' && antes?.serie_id) {
    const { data: sig } = await db.from('agenda_items').select('id').eq('serie_id', antes.serie_id).eq('fed_id', row.fed_id).eq('estado', 'planificada').gt('fecha', row.fecha)
    const ids = (sig ?? []).map(x => x.id as string)
    if (ids.length) {
      // El club/grupo también se aplica a las siguientes (p. ej., corregir 4° → 5° en toda la serie).
      const up = await db.from('agenda_items').update({ hora_inicio: row.hora_inicio, hora_fin: row.hora_fin, school_id: row.school_id, lugar: row.lugar, sub_accion: row.sub_accion, ...(esReunion(row.accion) ? { modalidad: row.modalidad, enlace: row.enlace } : {}), ...(clubId ? { club_id: clubId } : {}) }).in('id', ids).eq('fed_id', row.fed_id)
      if (up.error) throw new Error(up.error.message)
      if (enc) {
        const e = await db.from('agenda_encuentros').update({ propuesta: enc.propuesta, tipo_jornada: enc.tipo_jornada ?? null, modalidad: enc.modalidad, destinatarios: enc.destinatarios, school_id: row.school_id, lugar: row.lugar, ...(clubId ? { club_id: clubId } : {}) }).in('agenda_item_id', ids)
        if (e.error) throw new Error(e.error.message)
      }
      // Acompañantes: quienes se suman o se quitan en esta fecha también en las siguientes, con un solo aviso por serie.
      if (cambiosPart.quitar.length) {
        const q = await db.from('agenda_participantes').delete().in('item_id', ids).in('fed_id', cambiosPart.quitar)
        if (q.error) throw new Error(q.error.message)
      }
      if (cambiosPart.sumar.length) {
        const a = await db.from('agenda_participantes').upsert(ids.flatMap(item_id => cambiosPart.sumar.map(fed_id => ({ item_id, fed_id }))), { onConflict: 'item_id,fed_id', ignoreDuplicates: true })
        if (a.error) throw new Error(a.error.message)
        await db.from('notificaciones').update({ detalle: `Incluye esta fecha y ${ids.length} siguientes de la serie` }).eq('item_id', itemId).eq('tipo', 'etiqueta').in('fed_id', cambiosPart.sumar)
      }
      creadas += ids.length
      await audit('agenda_items', itemId, 'modificacion', row.fed_id, { serie: antes.serie_id, siguientes: ids.length, sumados: cambiosPart.sumar, quitados: cambiosPart.quitar })
    }
  }
  return { id: itemId, creadas }
}

// Compañeros etiquetados: se reemplaza la lista y se notifica a quienes se suman.
async function syncParticipantes(itemId: string, autorId: string, fedIds: string[], avisar = true): Promise<{ sumar: string[], quitar: string[] }> {
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
    const n = avisar ? await db.from('notificaciones').insert(sumar.map(fed_id => ({ fed_id, item_id: itemId, autor_id: autorId, tipo: 'etiqueta' }))) : { error: null }
    if (n.error) throw new Error(n.error.message)
  }
  return { sumar, quitar }
}

async function getNotificacionesImpl(fedId: string): Promise<Notificacion[]> {
  const { data, error } = await supabaseServer().from('notificaciones').select(`id, tipo, leida, created_at, autor_id, detalle, item:agenda_items(${ITEM_COLS})`)
    .eq('fed_id', fedId).order('created_at', { ascending: false }).limit(30)
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as Notificacion[]
}

// ---- Actividad del equipo (sólo CED y administración) ----
// Última actividad de cada FED: lo último que cargó, editó, cambió de estado o borró en la agenda, según la auditoría (no cuentan
// ingresos, cambios de perfil ni lo que hacen las migraciones). Días hábiles sin actividad: ver lib/actividad.ts.
type ActividadFed = Actividad & { ultima_ts: string | null }
async function actividadEquipoImpl(): Promise<ActividadFed[]> {
  const db = supabaseServer(), hoy = hoyAR()
  const { data: feds, error } = await db.from('feds').select('id, rol')
  if (error) throw new Error(error.message)
  const ids = (feds ?? []).filter(f => f.rol === 'fed').map(f => f.id as string)
  if (!ids.length) return []
  const [ultimas, fer, aus] = await Promise.all([
    Promise.all(ids.map(async id => {
      const { data } = await db.from('auditoria').select('created_at').eq('autor_id', id).in('tabla', ['agenda_items', 'clubes']).order('created_at', { ascending: false }).limit(1)
      return [id, (data?.[0]?.created_at as string | undefined) ?? null] as const
    })),
    db.from('feriados').select('fecha').neq('tipo', 'distrital'),
    db.from('agenda_items').select('fed_id, fecha').in('fed_id', ids).in('accion', ['LICENCIA', 'PARO']).lte('fecha', hoy),
  ])
  const noHabiles = new Set((fer.data ?? []).map(f => f.fecha as string))
  const ausencias = new Map<string, Set<string>>()
  for (const a of aus.data ?? []) ausencias.set(a.fed_id as string, (ausencias.get(a.fed_id as string) ?? new Set<string>()).add(a.fecha as string))
  return ultimas.map(([fed_id, ts]) => {
    const ultima = ts ? fechaAR(ts) : null
    const dias = diasSinActividad(ultima, hoy, noHabiles, ausencias.get(fed_id))
    return { fed_id, ultima, ultima_ts: ts, dias, alerta: hayAlerta(dias) }
  })
}
export const getActividadEquipo = async () => conUsuario(async (yo): Promise<Actividad[]> =>
  yo.esAdmin || yo.fed.rol === 'coordinacion' ? (await actividadEquipoImpl()).map(({ ultima_ts: _ts, ...a }) => a) : [])

// Un único aviso por persona y por período sin actividad, a la coordinación y a la administración (nunca al propio FED ni al resto del equipo).
// Se revisa cuando alguien de ellos abre la app (como mucho cada 10 minutos); el aviso queda resuelto cuando el FED vuelve a cargar algo.
let ultimoControlInactividad = 0
async function avisarInactividad(yo: Usuario) {
  if (!yo.esAdmin && yo.fed.rol !== 'coordinacion') return
  if (Date.now() - ultimoControlInactividad < 10 * 60_000) return
  ultimoControlInactividad = Date.now()
  const db = supabaseServer()
  const inactivos = (await actividadEquipoImpl()).filter(a => a.alerta && a.ultima && a.dias !== null)
  if (!inactivos.length) return
  const [{ data: dest }, { data: previas }] = await Promise.all([
    db.from('feds').select('id').or('rol.eq.coordinacion,es_admin.eq.true'),
    db.from('notificaciones').select('fed_id, autor_id, created_at').eq('tipo', 'inactividad').in('autor_id', inactivos.map(a => a.fed_id)),
  ])
  const nuevas = avisosPendientes(inactivos.map(a => ({ fed_id: a.fed_id, ultima: a.ultima!, ultima_ts: a.ultima_ts, dias: a.dias! })), (dest ?? []).map(d => d.id as string), (previas ?? []) as AvisoPrevio[])
  if (nuevas.length) await db.from('notificaciones').insert(nuevas)
}

async function marcarLeidasImpl(fedId: string, ids?: string[]): Promise<void> {
  let q = supabaseServer().from('notificaciones').update({ leida: true }).eq('fed_id', fedId).eq('leida', false)
  if (ids?.length) q = q.in('id', ids)
  const { error } = await q
  if (error) throw new Error(error.message)
}

async function siguienteEncuentro(clubId: string, fecha: string, excluirItem: string): Promise<number> {
  const db = supabaseServer()
  const [{ data }, { data: items }, { data: hechas }] = await Promise.all([
    db.from('agenda_encuentros').select('fecha, encuentro_n, agenda_item_id, item:agenda_items(estado)').eq('club_id', clubId),
    db.from('agenda_items').select('fecha').eq('club_id', clubId).in('estado', ['planificada', 'reprogramada']).lt('fecha', fecha).neq('id', excluirItem),
    db.from('agenda_items').select('id, fecha').eq('club_id', clubId).eq('estado', 'realizada').lte('fecha', fecha).neq('id', excluirItem),
  ])
  const encuentros = (data ?? []).map(e => ({ ...e, item: Array.isArray(e.item) ? e.item[0] ?? null : e.item }))
  return proximoEncuentro(conRealizadosSinRegistro(encuentros, (hechas ?? []) as { id: string, fecha: string }[]), fecha, excluirItem, (items ?? []).map(i => i.fecha as string))
}

// Club del encuentro: crea uno nuevo (inicia en esta fecha) o actualiza el elegido; marcar cierre lo finaliza.
async function upsertClub(input: AgendaItemInput, row: ReturnType<typeof clean>): Promise<string | null> {
  const e = input.encuentro!
  const db = supabaseServer()
  const previstos = num(e.encuentros_previstos) || null
  if (e.nuevo_club || !e.club_id) {
    if (!e.nuevo_club) return null
    // Las prácticas se hacen en varios lugares: el grupo se identifica por la escuela de origen de sus estudiantes y no lleva sede propia.
    const peat = row.accion === 'PRÁCTICAS PROFESIONALIZANTES'
    if (peat && !opt(e.escuela_origen_id)) throw new Error('Indicá la escuela de origen de los estudiantes')
    const { data, error } = await db.from('clubes').insert({
      fed_id: row.fed_id, school_id: peat ? null : row.school_id, lugar: peat ? null : row.lugar, grupo: opt(e.grupo), cohorte: row.accion === 'PRÁCTICAS PROFESIONALIZANTES' ? opt(e.cohorte) : null, escuela_origen_id: opt(e.escuela_origen_id), tipo: row.accion, propuesta: row.accion === 'PRÁCTICAS PROFESIONALIZANTES' ? 'Prácticas Educativas en Ambientes de Trabajo' : 'Club de Tecnología',
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
export type ClubPorIniciarInput = { fed_id: string, tipo: 'CLUB DE TECNOLOGÍA' | 'PRÁCTICAS PROFESIONALIZANTES', school_id: string | null, lugar: string | null, grupo: string, cohorte?: string | null, escuela_origen_id: string | null, encuentros_previstos: number | null }
async function crearClubPorIniciarImpl(c: ClubPorIniciarInput): Promise<void> {
  const db = supabaseServer()
  const { data: fed } = await db.from('feds').select('rol').eq('id', c.fed_id).maybeSingle()
  if (fed?.rol !== 'fed') throw new Error('Sólo un FED puede iniciar clubes o prácticas')
  if (c.tipo !== 'CLUB DE TECNOLOGÍA' && c.tipo !== 'PRÁCTICAS PROFESIONALIZANTES') throw new Error('Tipo inválido')
  const peat = c.tipo === 'PRÁCTICAS PROFESIONALIZANTES'
  if (peat ? !opt(c.escuela_origen_id) : !c.school_id && !opt(c.lugar)) throw new Error(peat ? 'Indicá la escuela de origen de los estudiantes' : 'Indicá el establecimiento o la sede')
  if (!opt(c.grupo)) throw new Error('Indicá el grado o curso')
  const previstos = c.encuentros_previstos && c.encuentros_previstos > 0 && c.encuentros_previstos < 100 ? Math.round(c.encuentros_previstos) : null
  const row = { fed_id: c.fed_id, school_id: peat ? null : c.school_id, lugar: peat || c.school_id ? null : opt(c.lugar), grupo: opt(c.grupo), cohorte: c.tipo === 'PRÁCTICAS PROFESIONALIZANTES' ? opt(c.cohorte) : null, escuela_origen_id: opt(c.escuela_origen_id), tipo: c.tipo,
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
// Acciones de la misma visita (propias); si no es parte de una visita, sólo ésta.
async function idsDeVisita(id: string, fedId: string): Promise<string[]> {
  const db = supabaseServer()
  const { data: it } = await db.from('agenda_items').select('visita_id').eq('id', id).eq('fed_id', fedId).maybeSingle()
  if (!it?.visita_id) return [id]
  const { data } = await db.from('agenda_items').select('id').eq('visita_id', it.visita_id).eq('fed_id', fedId)
  return (data ?? []).map(x => x.id as string)
}

async function setItemStatusImpl(id: string, fedId: string, estado: AgendaItemInput['estado']): Promise<void> {
  if (!ESTADOS.includes(estado)) throw new Error('Estado inválido')
  // En una visita con varias acciones, el estado es uno solo: se aplica a todas.
  const ids = await idsDeVisita(id, fedId)
  const { data, error } = await supabaseServer().from('agenda_items').update({ estado }).in('id', ids).eq('fed_id', fedId).select('id')
  if (error) throw new Error(error.message)
  if (!data?.length) throw new Error('Sólo quien creó la acción puede cambiar su estado')
  if (estado === 'cancelada') await avisarParticipantes(id, fedId, 'cancelacion', 'Canceló la acción')
  else if (estado === 'reprogramada') await avisarParticipantes(id, fedId, 'modificacion', 'La marcó como reprogramada')
  await audit('agenda_items', id, 'estado', fedId, { estado })
}

// Eliminar una acción; con `serie`, también las siguientes planificadas de la misma serie.
async function deleteItemImpl(id: string, fedId: string, serie = false): Promise<number> {
  const db = supabaseServer()
  const { data: item } = await db.from('agenda_items').select('id, fecha, accion, serie_id, visita_id').eq('id', id).eq('fed_id', fedId).maybeSingle()
  if (!item) throw new Error('La acción no existe o no es tuya')
  // Una visita se elimina completa (todas sus acciones); con `serie`, también las siguientes de cada tipo.
  const miembros = item.visita_id ? ((await db.from('agenda_items').select('id, serie_id, fecha').eq('visita_id', item.visita_id).eq('fed_id', fedId)).data ?? []) : [item]
  let ids = miembros.map(m => m.id as string)
  if (serie) for (const m of miembros) if (m.serie_id) {
    const { data } = await db.from('agenda_items').select('id').eq('serie_id', m.serie_id).eq('fed_id', fedId).eq('estado', 'planificada').gt('fecha', m.fecha)
    ids = [...new Set([...ids, ...(data ?? []).map(x => x.id as string)])]
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
  const franjas = Object.fromEntries(datos.ddjj.map(d => [d.dia, franjasDte(d)]))
  const errores = validarDdjj(franjas, cargosDe(datos.ddjj))
  if (datos.ddjj.some(d => !Number.isInteger(d.dia) || d.dia < 1 || d.dia > 5)) errores.push('Día de la DD.JJ. inválido')
  if (errores.length) throw new Error(errores[0])
  const ddjj = armarDdjj(franjas, cargosDe(datos.ddjj), Object.fromEntries(datos.ddjj.filter(d => d.externo).map(d => [d.dia, d.externo!.slice(0, 200)])))
  // Los distritos a cargo no se modifican desde el perfil: los asigna la administración.
  const patch = { carga_horaria: cargaDeDdjj(ddjj), ddjj }
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

async function confirmarFeriadoImpl(autorId: string, id: string, confirmado: boolean): Promise<void> {
  await esCoordinacion(autorId)
  const { error } = await supabaseServer().from('feriados').update({ confirmado }).eq('id', id)
  if (error) throw new Error(error.message)
  await audit('feriados', id, 'modificacion', autorId, { confirmado })
}

async function getFeriadosImpl(from: string, to: string): Promise<Feriado[]> {
  const { data, error } = await supabaseServer().from('feriados').select('id, fecha, nombre, tipo, distrito, confirmado').gte('fecha', from).lte('fecha', to).order('fecha')
  if (error) throw new Error(error.message)
  const reales = (data ?? []) as Feriado[]
  // Enero es receso de verano: se suma a los feriados cargados (salvo los días que ya tienen uno no distrital).
  const ocupados = new Set(reales.filter(f => f.tipo !== 'distrital').map(f => f.fecha))
  return [...reales, ...recesoEnero(from, to).filter(f => !ocupados.has(f.fecha))].sort((a, b) => a.fecha.localeCompare(b.fecha))
}

// ---- Acciones en bloque (selección múltiple): sólo sobre acciones propias; un aviso por compañero, no uno por acción.
async function propias(ids: string[], fedId: string) {
  if (!ids.length || ids.length > 300) throw new Error('Seleccioná entre 1 y 300 acciones')
  const { data, error } = await supabaseServer().from('agenda_items').select('id, fecha, accion, estado, club_id').in('id', ids).eq('fed_id', fedId)
  if (error) throw new Error(error.message)
  return data ?? []
}
async function avisarEnBloque(ids: string[], autorId: string, detalle: string) {
  const db = supabaseServer()
  // Sólo las acciones de hoy o futuras: las pasadas no avisan.
  const { data: vigentes } = await db.from('agenda_items').select('id').in('id', ids).gte('fecha', hoyAR())
  if (!vigentes?.length) return
  const { data } = await db.from('agenda_participantes').select('fed_id').in('item_id', vigentes.map(v => v.id as string))
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
// Acciones cargadas en fin de semana (antes de exigir días hábiles): pasan al día hábil anterior o siguiente (también su encuentro, si tiene).
async function moverFinDeSemanaImpl(ids: string[], fedId: string, destino: 'viernes' | 'lunes') {
  const lista = await propias(ids, fedId)
  const db = supabaseServer()
  const { data: fer } = await db.from('feriados').select('fecha').neq('tipo', 'distrital')
  const noHabiles = new Set((fer ?? []).map(f => f.fecha as string))
  let movidas = 0
  for (const i of lista) {
    const d = new Date(`${i.fecha}T12:00:00`), dia = d.getDay()
    if (dia !== 0 && dia !== 6) continue
    // Al día hábil anterior o siguiente (si el viernes o el lunes es feriado, sigue de largo).
    const ymd = () => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    do d.setDate(d.getDate() + (destino === 'viernes' ? -1 : 1))
    while (d.getDay() === 0 || d.getDay() === 6 || noHabiles.has(ymd()) || esEnero(ymd()))
    const nueva = ymd()
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
// Un FED ve el nombre, el rol y los distritos de sus compañeros, pero no sus horarios (DD.JJ.) ni su carpeta de fotos: eso lo ven la coordinación y la administración.
export const getFeds = async () => conUsuario(async yo => {
  const l = await getFedsImpl()
  return veTodoElEquipo(quienEs(yo)) ? l : l.map(f => (f.id === yo.fed.id ? f : { ...f, ddjj: [], carpeta_fotos_url: null }))
})
export const searchSchools = async (query: string) => conUsuario(() => searchSchoolsImpl(query))
export const getFichaEscuela = async (id: string) => conUsuario(yo => getFichaEscuelaImpl(yo, id))
export const getConectividadEscuela = async (id: string) => conUsuario(() => getConectividadEscuelaImpl(id))
export const registrarReclamo = async (input: { school_id: string, tipo: string, asunto: string }) => conUsuario(yo => rc.registrarReclamoImpl(yo, input))
export const getReclamos = async () => conUsuario(() => rc.getReclamosImpl())
export const getAccesos = async () => conUsuario(yo => getAccesosImpl(yo))
export const getMisEscuelas = async () => conUsuario(yo => getMisEscuelasImpl(yo))
export const getExtrasEscuela = async (id: string) => conUsuario(yo => getExtrasEscuelaImpl(yo, id))
export const getCruceReclamos = async () => conUsuario(yo => rc.getCruceReclamosImpl(yo))
export const getPuntosMapa = async () => conUsuario(() => getPuntosMapaImpl())
export const getJefatura = async (id: string) => conUsuario(yo => getJefaturaImpl(yo, id))
export const guardarJefatura = async (id: string, cambios: Record<string, unknown>) => conUsuario(yo => guardarJefaturaImpl(yo, id, cambios))
export const getEdicionEscuela = async (id: string) => conUsuario(yo => getEdicionEscuelaImpl(yo, id))
export const guardarEscuela = async (id: string, cambios: Record<string, unknown>) => conUsuario(yo => guardarEscuelaImpl(yo, id, cambios))
export const guardarContacto = async (id: string, contactoId: string | null, contacto: ContactoInput) => conUsuario(yo => guardarContactoImpl(yo, id, contactoId, contacto))
export const borrarContacto = async (id: string, contactoId: string) => conUsuario(yo => borrarContactoImpl(yo, id, contactoId))
export const contactoPrincipal = async (id: string, contactoId: string) => conUsuario(yo => principalContactoImpl(yo, id, contactoId))
export const getCronogramas = async () => conUsuario(yo => rc.getCronogramasImpl(yo))
export const avisarCronograma = async (id: string, aviso: AvisoCronograma) => conUsuario(yo => rc.avisarCronogramaImpl(yo, id, aviso))
export const getContactosCronograma = async (id: string) => conUsuario(yo => rc.getContactosCronogramaImpl(yo, id))
export const marcarCronograma = async (id: string, estado: EstadoSeguimiento, nota: string) => conUsuario(yo => rc.marcarCronogramaImpl(yo, id, estado, nota))
export const sincronizarCronogramasAhora = async () => conUsuario(yo => rc.sincronizarCronogramasAhoraImpl(yo))
export const reclamosAbiertosDe = async (schoolId: string) => conUsuario(() => rc.reclamosAbiertosDeImpl(schoolId))
export const resolverReclamo = async (id: string, nota: string | null) => conUsuario(yo => rc.resolverReclamoImpl(yo, id, nota))
export const actualizarReclamo = async (id: string, cambios: { estado?: EstadoReclamo, nro_incidencia?: string | null, notas?: string | null }) => conUsuario(yo => rc.actualizarReclamoImpl(yo, id, cambios))

// Jefaturas distritales y regional (organismos descentralizados, con código propio en lugar de CUE).
// Al elegir una se guarda como lugar "NOMBRE (CÓDIGO)", el mismo formato que venían usando a mano.
export type Organismo = { id: string, codigo: string, nombre: string, distrito: string | null, localidad: string | null, domicilio: string | null, lat: number | null, lon: number | null }
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
export const getFedItems = async (fedId: string, from: string, to: string) => conUsuario(yo => {
  if (!puedeVerAgendaDe(quienEs(yo), fedId)) throw new Error('Solo podés ver tu propia agenda')
  return getFedItemsImpl(fedId, from, to)
})
// El equipo completo es de la coordinación y la administración; un FED recibe solo lo suyo (sus acciones y las que comparte).
export const getAllItems = async (from: string, to: string) => conUsuario(yo => (veTodoElEquipo(quienEs(yo)) ? getAllItemsImpl(from, to) : getFedItemsImpl(yo.fed.id, from, to)))
export const disponibilidad = async (fecha: string, ids: string[], excluir?: string) => conUsuario(yo => disponibilidadImpl(yo, fecha, ids, excluir))
export const getEncuentros = async (from: string, to: string) => conUsuario(async yo => {
  const todos = await getEncuentrosImpl(from, to)
  return veTodoElEquipo(quienEs(yo)) ? todos : todos.filter(e => e.fed_id === yo.fed.id)
})
export const saveItem = async (input: AgendaItemInput, id?: string, alcance: 'uno' | 'siguientes' = 'uno') => conUsuario(yo => saveItemImpl({ ...input, fed_id: yo.fed.id }, id, alcance))
// Visita con varias acciones: una acción por tipo, con la misma escuela, fecha, horario y acompañantes.
// Cada compañero recibe un solo aviso (el de la primera acción, con el resumen de la visita).
// Si una falla, las anteriores quedan guardadas y se informa cuáles, para no duplicarlas al reintentar.
export const guardarVisita = async (inputs: AgendaItemInput[]) => conUsuario(async yo => {
  if (!inputs.length || inputs.length > 8) throw new Error('Una visita puede tener entre 1 y 8 acciones')
  const guardadas: AgendaItemInput['accion'][] = []
  let creadas = 0, primera: string | null = null
  const visitaId = inputs.length > 1 ? crypto.randomUUID() : null
  for (const [k, input] of inputs.entries()) {
    try {
      const r = await saveItemImpl({ ...input, fed_id: yo.fed.id, visita_id: visitaId }, undefined, 'uno', k === 0)
      creadas += r.creadas; guardadas.push(input.accion); if (k === 0) primera = r.id
    } catch (e) {
      return { creadas, guardadas, error: `${input.accion.toLowerCase()}: ${e instanceof Error ? e.message : String(e)}` }
    }
  }
  // Serie: las copias heredaron el mismo visita_id; cada fecha es una visita propia.
  if (visitaId && inputs[0].repeticion) {
    const db = supabaseServer()
    const { data } = await db.from('agenda_items').select('id, fecha').eq('visita_id', visitaId).eq('fed_id', yo.fed.id).neq('fecha', inputs[0].fecha)
    const porFecha = new Map<string, string[]>()
    for (const r of data ?? []) porFecha.set(r.fecha as string, [...(porFecha.get(r.fecha as string) ?? []), r.id as string])
    for (const ids of porFecha.values()) await db.from('agenda_items').update({ visita_id: crypto.randomUUID() }).in('id', ids).eq('fed_id', yo.fed.id)
  }
  if (primera && inputs.length > 1) {
    const lista = inputs.map(i => i.accion.toLowerCase()).join(', ')
    await supabaseServer().from('notificaciones').update({ detalle: `Visita con ${inputs.length} acciones: ${lista}${inputs[0].repeticion ? ' · se repite cada semana' : ''}` }).eq('item_id', primera).eq('tipo', 'etiqueta')
  }
  return { creadas, guardadas, error: null as string | null }
})
// Editar una visita (o sumar tipos a una acción suelta): un pedido por tipo marcado, en orden.
// Los datos comunes se aplican a todas; un tipo desmarcado se elimina; uno nuevo se agrega a la visita.
export const editarVisita = async (itemId: string, inputs: AgendaItemInput[], alcance: 'uno' | 'siguientes' = 'uno') => conUsuario(async yo => {
  if (!inputs.length || inputs.length > 8) throw new Error('Una visita puede tener entre 1 y 8 acciones')
  const db = supabaseServer(), fedId = yo.fed.id
  const { data: base } = await db.from('agenda_items').select('id, visita_id').eq('id', itemId).eq('fed_id', fedId).maybeSingle()
  if (!base) throw new Error('La acción no existe o no es tuya')
  const miembros = base.visita_id ? ((await db.from('agenda_items').select('id, accion, fecha, serie_id').eq('visita_id', base.visita_id).eq('fed_id', fedId)).data ?? []) : ((await db.from('agenda_items').select('id, accion, fecha, serie_id').eq('id', itemId)).data ?? [])
  const visitaId = inputs.length > 1 ? (base.visita_id as string | null) ?? crypto.randomUUID() : null
  let creadas = 0
  for (const [k, input] of inputs.entries()) {
    const m = miembros.find(x => x.accion === input.accion)
    const r = m ? await saveItemImpl({ ...input, fed_id: fedId, visita_id: visitaId, repeticion: null }, m.id as string, alcance, k === 0)
      : await saveItemImpl({ ...input, fed_id: fedId, visita_id: visitaId, repeticion: null }, undefined, 'uno', false)
    creadas += r.creadas
  }
  // Tipos desmarcados: se eliminan (con "esta y las siguientes", también las fechas planificadas que siguen de ese tipo).
  const quitar = miembros.filter(x => !inputs.some(i => i.accion === x.accion))
  for (const q of quitar) {
    let ids = [q.id as string]
    if (alcance === 'siguientes' && q.serie_id) ids = [...ids, ...((await db.from('agenda_items').select('id').eq('serie_id', q.serie_id).eq('fed_id', fedId).eq('estado', 'planificada').gt('fecha', q.fecha)).data ?? []).map(x => x.id as string)]
    const d = await db.from('agenda_items').delete().in('id', ids).eq('fed_id', fedId)
    if (d.error) throw new Error(d.error.message)
  }
  if (quitar.length) await audit('agenda_items', itemId, 'baja', fedId, { visita: visitaId, quitados: quitar.map(q => q.accion) })
  return { creadas, quitadas: quitar.length }
})
export const setItemStatus = async (id: string, _fedId: string, estado: AgendaItemInput['estado']) => conUsuario(yo => setItemStatusImpl(id, yo.fed.id, estado))
export const deleteItem = async (id: string, _fedId: string, serie = false) => conUsuario(yo => deleteItemImpl(id, yo.fed.id, serie))
export const cambiarEstadoVarias = async (ids: string[], estado: AgendaItemInput['estado']) => conUsuario(yo => cambiarEstadoVariasImpl(ids, yo.fed.id, estado))
export const eliminarVarias = async (ids: string[]) => conUsuario(yo => eliminarVariasImpl(ids, yo.fed.id))
export const moverFinDeSemana = async (ids: string[], destino: 'viernes' | 'lunes') => conUsuario(yo => moverFinDeSemanaImpl(ids, yo.fed.id, destino))
export const getFeriados = async (from: string, to: string) => conUsuario(() => getFeriadosImpl(from, to))
// Tipos de acción que más carga cada uno en el último año (para mostrarlos primero en el formulario).
export const misTiposFrecuentes = async () => conUsuario(async yo => {
  const desde = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10)
  const { data, error } = await supabaseServer().from('agenda_items').select('accion').eq('fed_id', yo.fed.id).gte('fecha', desde).limit(5000)
  if (error) throw new Error(error.message)
  const n = new Map<string, number>()
  for (const r of data ?? []) n.set(r.accion as string, (n.get(r.accion as string) ?? 0) + 1)
  return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([accion]) => accion as AgendaItemInput['accion'])
})

export type { EventoInput } from '@/lib/servidor/eventos'
// Eventos DTE: los carga administración; cada FED registra su participación (acción "EVENTO DTE" vinculada).
export const getEventos = async (from: string, to: string) => conUsuario(yo => eventos.getEventos(yo, from, to))
export const listarEventos = async (anio: number) => conUsuario(yo => eventos.listarEventos(yo, anio))
export const guardarEvento = async (ev: EventoInput, id?: string) => conUsuario(yo => eventos.guardarEvento(yo, ev, id))
export const eliminarEvento = async (id: string) => conUsuario(yo => eventos.eliminarEvento(yo, id))
export const miParticipacion = async (eventoId: string) => conUsuario(yo => eventos.miParticipacion(yo, eventoId))
export const registrarParticipacion = async (eventoId: string, fechas: string[]) => conUsuario(yo => eventos.registrarParticipacion(yo, eventoId, fechas))

export const getClubes = async (fedId?: string) => conUsuario(yo => getClubesImpl(veTodoElEquipo(quienEs(yo)) ? fedId : yo.fed.id))
export const setClubCierre = async (id: string, fecha: string | null) => conUsuario(async yo => {
  const { data } = await supabaseServer().from('clubes').select('fed_id').eq('id', id).maybeSingle()
  if (!data || (data.fed_id !== yo.fed.id && !yo.esAdmin)) throw new Error('Sólo quien lleva el club puede finalizarlo o reactivarlo')
  return setClubCierreImpl(id, fecha)
})
export const getNotificaciones = async (_fedId: string) => conUsuario(async yo => { await avisarInactividad(yo).catch(() => {}); return getNotificacionesImpl(yo.fed.id) })
export const marcarLeidas = async (_fedId: string, ids?: string[]) => conUsuario(yo => marcarLeidasImpl(yo.fed.id, ids))
export const responder = async (itemId: string, _fedId: string, respuesta: 'acepta' | 'rechaza') => conUsuario(yo => responderImpl(itemId, yo.fed.id, respuesta))
export const getHistorial = async (itemId: string) => conUsuario(async yo => {
  const accion = await datosDeAccion(itemId)
  if (!veTodoElEquipo(quienEs(yo)) && !(accion && puedeVerAccion(quienEs(yo), accion))) throw new Error('No podés ver el historial de esta acción')
  return getHistorialImpl(itemId)
})
export const crearClubPorIniciar = async (c: ClubPorIniciarInput) => conUsuario(yo => crearClubPorIniciarImpl({ ...c, fed_id: yo.fed.id }))
export const updateMiPerfil = async (_fedId: string, datos: Pick<Fed, 'distritos_a_cargo' | 'carga_horaria' | 'ddjj'>) => conUsuario(yo => updateMiPerfilImpl(yo.fed.id, datos))
export const addFeriado = async (_autorId: string, f: Omit<Feriado, 'id'>) => conUsuario(yo => addFeriadoImpl(yo.fed.id, f))
export const deleteFeriado = async (_autorId: string, id: string) => conUsuario(yo => deleteFeriadoImpl(yo.fed.id, id))
export const confirmarFeriado = async (id: string, confirmado: boolean) => conUsuario(yo => confirmarFeriadoImpl(yo.fed.id, id, confirmado))

export type { EstadoFotos, PveEvento, PveMes, PveFed, ConteoFotos } from '@/lib/servidor/fotos-pve'
// Fotos en Google Drive: carpeta propia de cada FED, ordenada por día por la cuenta técnica.
export const estadoFotos = async () => conUsuario(yo => fotos.estadoFotos(yo))
export const guardarCarpetaFotos = async (url: string) => conUsuario(yo => fotos.guardarCarpetaFotos(yo, url))
export const ordenarMisFotos = async () => conUsuario(yo => fotos.ordenarMisFotos(yo))

// PVE (Planillas de Visita a Escuelas): el FED sube un PDF por mes a su carpeta; la coordinación las descarga juntas.
export const misPve = async (revisar = false) => conUsuario(yo => fotos.misPve(yo, revisar))
export const abrirCarpetaPve = async (mes: string) => conUsuario(yo => fotos.abrirCarpetaPve(yo, mes))
export const pveEquipo = async (mes: string) => run(() => fotos.pveEquipo(mes))
export const marcarPveEnviadas = async (mes: string) => run(() => fotos.marcarPveEnviadas(mes))
export const devolverPve = async (fedId: string, mes: string, motivo: string) => run(() => fotos.devolverPve(fedId, mes, motivo))
export const fotosDelDia = async (fedIds: string[], fecha: string, itemId?: string) => conUsuario(yo => fotos.fotosDelDia(yo, fedIds, fecha, itemId))
export const conteoFotos = async () => conUsuario(yo => fotos.conteoFotos(yo))

export type { Sesion } from '@/lib/servidor/sesion'
// Sesión: ingreso, salida y cambio de contraseña.
export const miSesion = async () => run(() => sesion.miSesion())
export const ingresar = async (email: string, password: string) => run(() => sesion.ingresar(email, password))
export const salir = async () => run(() => sesion.salir())
export const cambiarPassword = async (nueva: string, actual = '') => run(() => sesion.cambiarPassword(nueva, actual))

export type { UsuarioEquipo } from '@/lib/servidor/usuarios'
// Usuarios (sólo administración): alta de cuentas y reseteo de contraseñas.
export const listarUsuarios = async () => run(() => usuarios.listarUsuarios())
export const generarPasswordTemporal = async (fedId: string) => run(() => usuarios.generarPasswordTemporal(fedId))

// ---------- Comunicados del CED a los FED (la lógica está en lib/servidor/comunicados.ts) ----------
export type { ComunicadoPendiente, ComunicadoGestion } from '@/lib/servidor/comunicados'
export const getComunicadosPendientes = async () => conUsuario(yo => comunicados.comunicadosPendientes(yo))
export const marcarComunicadoLeido = async (id: string) => conUsuario(yo => comunicados.marcarLeido(yo, id))
export const getComunicadosGestion = async () => conUsuario(yo => comunicados.comunicadosGestion(yo))
export const crearComunicado = async (e: EntradaComunicado) => conUsuario(yo => comunicados.crear(yo, e))
export const editarComunicado = async (id: string, e: EntradaComunicado) => conUsuario(yo => comunicados.editar(yo, id, e))
export const eliminarComunicado = async (id: string) => conUsuario(yo => comunicados.eliminar(yo, id))
export const retirarComunicado = async (id: string) => conUsuario(yo => comunicados.retirar(yo, id))
