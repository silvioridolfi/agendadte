import 'server-only'
import { supabaseServer } from '@/lib/supabase-server'
import { esAusencia, type AgendaItem, type School } from '@/lib/agenda'
import { type Usuario } from '@/lib/sesion'
import { hoyAR } from '@/lib/hora'
import * as rc from '@/lib/servidor/reclamos-cronogramas'
import { ITEM_COLS, UUID, fetchAll } from '@/lib/servidor/comun'
import type { ClubDeEscuela, DatosEscuela, FichaEscuela, FilaHistorial } from '@/lib/escuela'
import { type EscuelaConectividad } from '@/lib/reclamos'
import { type Reclamo } from '@/lib/reclamos-registro'
import { DIAS_ATRAS, esDelFed, haceDias, type Cronograma } from '@/lib/cronogramas'
import { armarResumen, contarAccesos, type Accesos, type ContactoEscuela, type ResumenEscuela } from '@/lib/mis-escuelas'
import { COLS_ORGANISMO, cambiosDeOrganismo, type Jefatura, type JefaturaResumen, type ValoresOrganismo } from '@/lib/organismos'
import type { PuntoMapa, PuntosMapa } from '@/lib/mapa'
import { gruposPorPredio, hermanasDe } from '@/lib/predio'
import { resumenProximos } from '@/lib/cruce'
import { CLAVES_CONECTIVIDAD, COLS_EDITABLES, ORIGEN_OPCIONES, cambiosDeEscuela, historialDeContacto, nivelEdicion, resumenContacto, seccionDe, validarContacto, type ContactoEditable, type ContactoInput, type EdicionEscuela, type NivelEdicion, type OpcionesEscuela, type ValoresEscuela } from '@/lib/escuelas-edicion'

// Escuelas, mis escuelas, edición de fichas, contactos y jefaturas: las reglas por rol viven acá; app/actions.ts exige la sesión y delega.
// Todas las escuelas con predio, agrupadas por número: para mostrar con quién comparten edificio.
export const predioValidoServidor = (p: unknown) => (typeof p === 'number' && p > 0 ? p : null)

export async function gruposDePredio(db: ReturnType<typeof supabaseServer>) {
  return gruposPorPredio(await fetchAll<{ id: string, cue: number | null, nombre: string | null, predio: number | null }>((a, b) => db.from('establecimientos').select('id, cue, nombre, predio').not('predio', 'is', null).order('id').range(a, b)))
}

export async function searchSchoolsImpl(query: string): Promise<School[]> {
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
export const COLS_ESCUELA = `id, cue, nombre, alias, distrito, ciudad, direccion, lat, lon, predio, nivel, modalidad, ambito, turnos, matricula, varones, mujeres, secciones, fed_a_cargo, ${CLAVES_CONECTIVIDAD.join(', ')}`

export async function getFichaEscuelaImpl(yo: Usuario, id: string): Promise<FichaEscuela> {
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
export async function contactosDe(db: ReturnType<typeof supabaseServer>, cue: number | null): Promise<ContactoEscuela[]> {
  if (cue == null) return []
  const { data, error } = await db.from('contactos').select('nombre, apellido, cargo, telefono, correo, correo_laboral, es_principal').eq('cue', cue).order('es_principal', { ascending: false }).order('apellido')
  if (error) throw new Error(error.message)
  return ((data ?? []) as ContactoEscuela[]).filter(c => [c.nombre, c.apellido, c.telefono, c.correo, c.correo_laboral].some(v => v && v.trim()))
}

// Jefatura distrital del distrito de la escuela (si hay).
export async function jefaturaDe(db: ReturnType<typeof supabaseServer>, distrito: string | null): Promise<JefaturaResumen | null> {
  if (!distrito) return null
  const { data } = await db.from('organismos_descentralizados').select('id, nombre, telefono, email').eq('subtipo_organizacion', 'Jefatura Distrital').eq('distrito', distrito).limit(1).maybeSingle()
  return data ? { id: data.id as string, nombre: data.nombre as string, telefono: (data.telefono as string | null) ?? null, email: (data.email as string | null) ?? null } : null
}

// Lo que la base sabe de la conectividad de una escuela (enlace, piso y proveedores): para armar reclamos de conectividad.
export async function getConectividadEscuelaImpl(id: string): Promise<EscuelaConectividad> {
  if (!UUID.test(id)) throw new Error('Escuela inválida')
  const { data, error } = await supabaseServer().from('establecimientos').select('id, cue, nombre, distrito, ciudad, direccion, matricula, plan_enlace, subplan_enlace, plan_piso_tecnologico, tipo_piso_instalado, tipo, nivel, proveedor_internet_pnce, proveedor_asignado_pba, reclamos_grupo_1_ani, recurso_primario, access_id').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No se encontró la escuela')
  const t = (v: unknown) => (v == null || String(v).trim() === '' ? null : String(v).trim())
  return { id: data.id as string, cue: (data.cue as number | null) ?? null, nombre: t(data.nombre), distrito: t(data.distrito), ciudad: t(data.ciudad), direccion: t(data.direccion), matricula: data.matricula == null ? null : Number(data.matricula),
    plan_enlace: t(data.plan_enlace), subplan_enlace: t(data.subplan_enlace), plan_piso_tecnologico: t(data.plan_piso_tecnologico), tipo_piso_instalado: t(data.tipo_piso_instalado), tipo: t(data.tipo),
    proveedor_pnce: t(data.proveedor_internet_pnce), proveedor_pba: t(data.proveedor_asignado_pba), ani: t(data.reclamos_grupo_1_ani), recurso_primario: t(data.recurso_primario), access_id: t(data.access_id),
    nivel: t(data.nivel), contactos: await contactosDe(supabaseServer(), (data.cue as number | null) ?? null) }
}

// ---- Mis escuelas: las escuelas que tiene a cargo cada FED (establecimientos.fed_a_cargo). La coordinación y la administración ven todas.
export async function getMisEscuelasImpl(yo: Usuario): Promise<ResumenEscuela[]> {
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
export async function getAccesosImpl(yo: Usuario): Promise<Accesos> {
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

export async function getExtrasEscuelaImpl(yo: Usuario, id: string): Promise<ExtrasEscuela> {
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
export const COLS_CONTACTO_EDITABLE = 'id, nombre, apellido, cargo, telefono, correo, correo_laboral, es_principal'

export async function escuelaEditable(yo: Usuario, id: string) {
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

export const unicosOrdenados = (l: (string | null | undefined)[]) => [...new Set(l.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, 'es'))

export async function opcionesEscuela(db: ReturnType<typeof supabaseServer>): Promise<OpcionesEscuela> {
  const columnas = [...new Set(Object.values(ORIGEN_OPCIONES).flat())]
  const [filas, feds] = await Promise.all([
    fetchAll<Record<string, string | null>>((a, b) => db.from('establecimientos').select(`id, ${columnas.join(', ')}`).order('id').range(a, b)),
    db.from('feds').select('nombre_completo').eq('rol', 'fed'),
  ])
  const opciones: OpcionesEscuela = Object.fromEntries(Object.entries(ORIGEN_OPCIONES).map(([clave, cols]) => [clave, unicosOrdenados(filas.flatMap(f => cols.map(c => f[c]?.trim())))]))
  opciones.fed_a_cargo = unicosOrdenados((feds.data ?? []).map(f => f.nombre_completo as string))
  return opciones
}

export async function anotarCambios(db: ReturnType<typeof supabaseServer>, escuelaId: string, autorId: string, filas: { seccion: string, campo: string, valor_anterior: string | null, valor_nuevo: string | null }[]) {
  if (!filas.length) return
  const { error } = await db.from('historial_cambios').insert(filas.map(f => ({ ...f, establecimiento_id: escuelaId, autor_id: autorId })))
  if (error) throw new Error(error.message)
}

export async function getEdicionEscuelaImpl(yo: Usuario, id: string): Promise<EdicionEscuela> {
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
export async function guardarEscuelaImpl(yo: Usuario, id: string, cambios: Record<string, unknown>): Promise<number> {
  const { db, e, nivel } = await escuelaEditable(yo, id)
  const lista = cambiosDeEscuela(e, cambios, nivel as NivelEdicion, await opcionesEscuela(db))
  if (!lista.length) return 0
  const { error } = await db.from('establecimientos').update(Object.fromEntries(lista.map(c => [c.clave, c.valor]))).eq('id', id)
  if (error) throw new Error(error.message)
  await anotarCambios(db, id, yo.fed.id, lista.map(c => ({ seccion: seccionDe(c.clave), campo: c.label, valor_anterior: c.anterior, valor_nuevo: c.nuevo })))
  return lista.length
}

export async function contactoDe(db: ReturnType<typeof supabaseServer>, cue: number | null, contactoId: string) {
  if (!UUID.test(contactoId)) throw new Error('Contacto inválido')
  const { data, error } = await db.from('contactos').select(COLS_CONTACTO_EDITABLE).eq('id', contactoId).eq('cue', cue ?? -1).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No se encontró el contacto en esta escuela')
  return data as unknown as ContactoEditable
}

// Alta (sin contactoId) o edición de un contacto de la escuela.
export async function guardarContactoImpl(yo: Usuario, id: string, contactoId: string | null, input: ContactoInput): Promise<void> {
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

export async function borrarContactoImpl(yo: Usuario, id: string, contactoId: string): Promise<void> {
  const { db, e } = await escuelaEditable(yo, id)
  const antes = await contactoDe(db, e.cue, contactoId)
  const { error } = await db.from('contactos').delete().eq('id', contactoId)
  if (error) throw new Error(error.message)
  await anotarCambios(db, id, yo.fed.id, [{ seccion: 'Contacto', campo: 'Contacto eliminado', valor_anterior: resumenContacto(antes), valor_nuevo: null }])
}

// El contacto principal es el que se muestra primero en los listados: queda uno solo por escuela.
export async function principalContactoImpl(yo: Usuario, id: string, contactoId: string): Promise<void> {
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
export async function getPuntosMapaImpl(): Promise<PuntosMapa> {
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

export async function getJefaturaImpl(yo: Usuario, id: string): Promise<Jefatura> {
  if (!UUID.test(id)) throw new Error('Jefatura inválida')
  const { data, error } = await supabaseServer().from('organismos_descentralizados').select(`id, codigo, nombre, subtipo_organizacion, distrito, ${COLS_ORGANISMO}`).eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Error('No se encontró la jefatura')
  const d = data as unknown as Record<string, string | number | null>
  const valores: ValoresOrganismo = Object.fromEntries(COLS_ORGANISMO.split(', ').map(k => [k, d[k] ?? null]))
  return { id, codigo: d.codigo as string, nombre: d.nombre as string, subtipo: d.subtipo_organizacion as string | null, distrito: d.distrito as string | null, valores, puedeEditar: yo.esAdmin || yo.fed.rol === 'coordinacion' }
}

// Sólo el CED y la administración. Queda anotado en la auditoría; no se avisa a nadie.
export async function guardarJefaturaImpl(yo: Usuario, id: string, cambios: Record<string, unknown>): Promise<number> {
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
