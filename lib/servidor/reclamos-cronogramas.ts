import 'server-only'
import { supabaseServer } from '@/lib/supabase-server'
import { type Usuario } from '@/lib/sesion'
import { hoyAR } from '@/lib/hora'
import { UUID, audit, errMsgServer, fetchAll, opt } from '@/lib/servidor/comun'
import { tipoDe } from '@/lib/reclamos'
import { ESTADOS_RECLAMO, avisoDeAlta, avisoDeCambio, conexionDe, estadoTrasActualizar, puedeResolverReclamo, sumarNota, type EstadoReclamo, type Reclamo } from '@/lib/reclamos-registro'
import { AVISOS_CRONOGRAMA, DIAS_ATRAS, ESTADOS_SEGUIMIENTO, MAX_NOTA, PIDE_MOTIVO, avisoDe, avisoEstadoCed, avisoJefaturaFed, esDelFed, haceDias, puedeAvisarJefatura, puedeMarcar, type AvisoCronograma, type Cronograma, type EstadoSeguimiento, type Seguimiento, type TipoSeguimiento } from '@/lib/cronogramas'
import { sincronizarCronogramas, type ResultadoSync } from '@/lib/cronogramas-sync'
import { type ContactoEscuela } from '@/lib/mis-escuelas'
import { cruceDe, proximosDe, type CronoCorto, type CruceReclamo, type EstadoCrono } from '@/lib/cruce'

// Reclamos de conectividad y cronogramas de Nivel Central: las reglas por rol viven acá; app/actions.ts exige la sesión y delega.
// ---- Registro de reclamos de conectividad: el FED registra el que armó y mandó al CED; el CED anota el N° de ticket o incidencia y si se resolvió.
export const COLS_RECLAMO = '*, school:establecimientos(nombre, distrito, ciudad, fed_a_cargo)'

export async function registrarReclamoImpl(yo: Usuario, input: { school_id: string, tipo: string, asunto: string }, enviadoAt?: string): Promise<string> {
  if (!UUID.test(input.school_id)) throw new Error('Escuela inválida')
  const tipo = tipoDe(input.tipo)
  if (!tipo) throw new Error('Tipo de reclamo inválido')
  const asunto = input.asunto.trim()
  const db = supabaseServer()
  const { data: esc, error } = await db.from('establecimientos').select('id, cue, plan_enlace, subplan_enlace, plan_piso_tecnologico').eq('id', input.school_id).maybeSingle()
  if (error) throw new Error(error.message)
  if (!esc) throw new Error('No se encontró la escuela')
  if (!/^06-01-\d{12} - CUE \d{8} - .+/.test(asunto) || !asunto.includes(`CUE ${esc.cue} - `)) throw new Error('El asunto no tiene el formato de la guía')
  // Si ya se registró este mismo reclamo (doble toque), no se duplica.
  const { data: previo } = await db.from('reclamos_conectividad').select('id').eq('fed_id', yo.fed.id).eq('asunto', asunto).maybeSingle()
  if (previo) return previo.id as string
  const row = { fed_id: yo.fed.id, school_id: esc.id, cue: esc.cue, tipo: tipo.id, tipo_label: tipo.asunto, conexion: conexionDe(esc as { plan_enlace: string | null, subplan_enlace: string | null, plan_piso_tecnologico: string | null }), asunto, origen: 'app' as const, ...(enviadoAt ? { enviado_at: enviadoAt } : {}) }
  const { data, error: e2 } = await db.from('reclamos_conectividad').insert(row).select('id').single()
  if (e2) throw new Error(e2.message)
  await audit('reclamos_conectividad', data.id as string, 'alta', yo.fed.id, row)
  // Se avisa al CED (coordinación) del reclamo nuevo, salvo que lo haya registrado él mismo.
  const { data: ceds } = await db.from('feds').select('id').eq('rol', 'coordinacion')
  const avisos = (ceds ?? []).filter(c => c.id !== yo.fed.id).map(c => ({ fed_id: c.id as string, autor_id: yo.fed.id, tipo: 'reclamo', detalle: avisoDeAlta({ cue: esc.cue as number | null, tipo_label: tipo.asunto }) }))
  if (avisos.length) await db.from('notificaciones').insert(avisos)
  return data.id as string
}

export async function getReclamosImpl(): Promise<Reclamo[]> {
  return fetchAll<Reclamo>((a, b) => supabaseServer().from('reclamos_conectividad').select(COLS_RECLAMO).order('enviado_at', { ascending: false }).order('id').range(a, b))
}

// Reclamos abiertos de una escuela: al armar uno nuevo se avisa para seguir la cadena original (la guía pide no abrir cadenas nuevas).
export async function reclamosAbiertosDeImpl(schoolId: string): Promise<Reclamo[]> {
  if (!UUID.test(schoolId)) throw new Error('Escuela inválida')
  const { data, error } = await supabaseServer().from('reclamos_conectividad').select(COLS_RECLAMO).eq('school_id', schoolId).in('estado', ['enviado', 'en_proceso']).order('enviado_at', { ascending: false }).limit(10)
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as Reclamo[]
}

// El FED a cargo de la escuela (o quien registró el reclamo) puede marcarlo como resuelto, con una nota opcional. No avisa a nadie: se usa para dejar al día reclamos
// que la escuela ya dio por solucionados (muchos, de meses anteriores). El resto de los cambios sigue siendo del CED.
export async function resolverReclamoImpl(yo: Usuario, id: string, nota: string | null): Promise<void> {
  if (!UUID.test(id)) throw new Error('Reclamo inválido')
  const db = supabaseServer()
  const { data: r, error } = await db.from('reclamos_conectividad').select('estado, fed_id, notas, school:establecimientos(fed_a_cargo)').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  if (!r) throw new Error('No se encontró el reclamo')
  const reclamo = r as unknown as Pick<Reclamo, 'estado' | 'fed_id' | 'notas' | 'school'>
  if (!puedeResolverReclamo({ id: yo.fed.id, nombre: yo.fed.nombre_completo }, reclamo)) throw new Error(reclamo.estado === 'resuelto' || reclamo.estado === 'anulado' ? 'El reclamo ya no está abierto' : 'Sólo el FED a cargo de la escuela puede marcarlo como resuelto')
  const texto = opt(nota)
  if ((texto ?? '').length > 500) throw new Error('La nota es demasiado larga')
  const notas = sumarNota(reclamo.notas, texto)
  const ahora = new Date().toISOString()
  const up = await db.from('reclamos_conectividad').update({ estado: 'resuelto', notas, resuelto_at: ahora, actualizado_por: yo.fed.id, updated_at: ahora }).eq('id', id).in('estado', ['enviado', 'en_proceso'])
  if (up.error) throw new Error(up.error.message)
  await audit('reclamos_conectividad', id, 'estado', yo.fed.id, { antes: { estado: reclamo.estado }, despues: { estado: 'resuelto', nota: texto }, por: 'fed' })
}

// Sólo el CED (coordinación) actualiza el registro; la administración lo ve en modo lectura.
export async function actualizarReclamoImpl(yo: Usuario, id: string, cambios: { estado?: EstadoReclamo, nro_incidencia?: string | null, notas?: string | null }): Promise<void> {
  if (yo.fed.rol !== 'coordinacion') throw new Error('Sólo la coordinación puede actualizar los reclamos')
  if (!UUID.test(id)) throw new Error('Reclamo inválido')
  const db = supabaseServer()
  const { data: antes, error } = await db.from('reclamos_conectividad').select('estado, nro_incidencia, notas, fed_id, cue, tipo_label').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  if (!antes) throw new Error('No se encontró el reclamo')
  const nro = cambios.nro_incidencia === undefined ? antes.nro_incidencia : opt(cambios.nro_incidencia)
  const notas = cambios.notas === undefined ? antes.notas : opt(cambios.notas)
  if ((nro ?? '').length > 200 || (notas ?? '').length > 1000) throw new Error('El texto es demasiado largo')
  if (cambios.estado !== undefined && !ESTADOS_RECLAMO.includes(cambios.estado)) throw new Error('Estado inválido')
  // Llegó un número de Nivel Central: el reclamo pasa a "en proceso" (salvo que se lo marque resuelto o anulado en el mismo cambio).
  const estado = estadoTrasActualizar({ estado: antes.estado as string, nro_incidencia: antes.nro_incidencia as string | null }, cambios, nro) as EstadoReclamo
  const row = { estado, nro_incidencia: nro, notas, resuelto_at: estado === 'resuelto' ? new Date().toISOString() : null, actualizado_por: yo.fed.id, updated_at: new Date().toISOString() }
  const up = await db.from('reclamos_conectividad').update(row).eq('id', id)
  if (up.error) throw new Error(up.error.message)
  await audit('reclamos_conectividad', id, estado !== antes.estado ? 'estado' : 'modificacion', yo.fed.id, { antes, despues: { estado, nro_incidencia: nro, notas } })
  // Se avisa al FED que envió el reclamo cuando llega el número o se resuelve (no a quien hizo el cambio).
  const aviso = avisoDeCambio({ estado: antes.estado as string, nro_incidencia: antes.nro_incidencia as string | null }, { estado, nro_incidencia: nro }, { cue: antes.cue as number | null, tipo_label: antes.tipo_label as string })
  if (aviso && antes.fed_id && antes.fed_id !== yo.fed.id) await db.from('notificaciones').insert({ fed_id: antes.fed_id, autor_id: yo.fed.id, tipo: 'reclamo', detalle: aviso })
}

// Cronogramas de Nivel Central (sincronizados desde el consolidado). La coordinación y la administración ven todos; cada FED, los de sus escuelas.
export const COLS_CRONOGRAMA = `id, cue, fecha_inicio, fecha_fin, tipo, proveedor, nro, semana, estado_planilla, instaladores, descripcion, observaciones, nombre_planilla, primera_vez_at, actualizado_at, school:establecimientos(id, nombre, distrito, ciudad, fed_a_cargo, turnos, direccion, lat, lon, predio)`

export type UltimaSync = { fin: string | null, resultado: Record<string, unknown> | null } | null

// Agrega a cada cronograma el historial de estados anotados (del más nuevo al más viejo).
export async function conHistorial(filas: Omit<Cronograma, 'historial'>[]): Promise<Cronograma[]> {
  const historial = new Map<string, Seguimiento[]>()
  for (let i = 0; i < filas.length; i += 200) {
    const { data, error } = await supabaseServer().from('cronogramas_seguimiento').select('cronograma_id, estado, nota, fed_id, created_at').in('cronograma_id', filas.slice(i, i + 200).map(c => c.id)).order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    for (const h of data ?? []) historial.set(h.cronograma_id as string, [...(historial.get(h.cronograma_id as string) ?? []), { estado: h.estado as TipoSeguimiento, nota: h.nota as string | null, fed_id: h.fed_id as string | null, created_at: h.created_at as string }])
  }
  return filas.map(c => ({ ...c, historial: historial.get(c.id) ?? [] }))
}

// Agrega a cada cronograma las otras escuelas que comparten su predio (por ejemplo, si el rack está instalado en una de ellas).
export async function conComparte(filas: Cronograma[]): Promise<Cronograma[]> {
  const predios = [...new Set(filas.map(c => c.school?.predio).filter((p): p is string => !!p))]
  const porPredio = new Map<string, { id: string, cue: number | null, nombre: string | null }[]>()
  for (let i = 0; i < predios.length; i += 100) {
    const { data, error } = await supabaseServer().from('establecimientos').select('id, cue, nombre, predio').in('predio', predios.slice(i, i + 100))
    if (error) throw new Error(error.message)
    for (const e of data ?? []) porPredio.set(String(e.predio), [...(porPredio.get(String(e.predio)) ?? []), { id: e.id as string, cue: e.cue as number | null, nombre: e.nombre as string | null }])
  }
  return filas.map(c => ({ ...c, comparte: (c.school?.predio ? porPredio.get(c.school.predio) ?? [] : []).filter(o => o.id !== c.school?.id).map(o => ({ cue: o.cue, nombre: o.nombre })) }))
}

// A cada cronograma, los reclamos de conectividad abiertos de su escuela.
export async function conReclamos(filas: Cronograma[]): Promise<Cronograma[]> {
  const ids = [...new Set(filas.map(c => c.school?.id).filter((x): x is string => !!x))]
  const porEscuela = new Map<string, NonNullable<Cronograma['reclamos']>>()
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabaseServer().from('reclamos_conectividad').select('id, school_id, tipo_label, estado, nro_incidencia, enviado_at').in('school_id', ids.slice(i, i + 100)).in('estado', ['enviado', 'en_proceso']).order('enviado_at', { ascending: false })
    if (error) throw new Error(error.message)
    for (const r of data ?? []) porEscuela.set(r.school_id as string, [...(porEscuela.get(r.school_id as string) ?? []), { id: r.id as string, tipo_label: r.tipo_label as string, estado: r.estado as string, nro_incidencia: r.nro_incidencia as string | null, enviado_at: r.enviado_at as string }])
  }
  return filas.map(c => ({ ...c, reclamos: c.school ? porEscuela.get(c.school.id) ?? [] : [] }))
}

export async function getCronogramasImpl(yo: Usuario): Promise<{ lista: Cronograma[], ultima: UltimaSync }> {
  const db = supabaseServer()
  const todos = yo.esAdmin || yo.fed.rol === 'coordinacion'
  const filas = (await fetchAll<Omit<Cronograma, 'historial'>>((a, b) => db.from('cronogramas').select(COLS_CRONOGRAMA).eq('en_planilla', true).gte('fecha_fin', haceDias(hoyAR(), DIAS_ATRAS))
    .order('fecha_inicio').order('cue').order('id').range(a, b))).filter(c => todos || esDelFed(c.school?.fed_a_cargo, yo.fed.nombre_completo))
  const lista = await conReclamos(await conComparte(await conHistorial(filas)))
  const { data } = await db.from('cron_ejecuciones').select('fin, resultado').in('tarea', ['cronogramas', 'cronogramas-manual']).not('fin', 'is', null).order('inicio', { ascending: false }).limit(1).maybeSingle()
  return { lista, ultima: todos ? ((data as UltimaSync) ?? null) : null }
}

// Anota que se avisó a la jefatura (el CED) o a la escuela (el FED a cargo, el CED o la administración). Una sola vez por cronograma.
// Cuando el CED avisa a la jefatura, el FED a cargo recibe una notificación: le falta avisar a la escuela.
export async function avisarCronogramaImpl(yo: Usuario, id: string, aviso: AvisoCronograma): Promise<Seguimiento> {
  if (!UUID.test(id)) throw new Error('Cronograma inválido')
  if (!AVISOS_CRONOGRAMA.includes(aviso)) throw new Error('Aviso inválido')
  const db = supabaseServer()
  const { data: c, error } = await db.from('cronogramas').select('id, cue, fecha_inicio, fecha_fin, tipo, school:establecimientos(nombre, fed_a_cargo)').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  const crono = c as unknown as (Pick<Cronograma, 'id' | 'cue' | 'fecha_inicio' | 'fecha_fin' | 'tipo'> & { school: { nombre: string | null, fed_a_cargo: string | null } | null }) | null
  if (!crono) throw new Error('No se encontró el cronograma')
  const quien = { esAdmin: yo.esAdmin, rol: yo.fed.rol, nombre: yo.fed.nombre_completo }
  if (aviso === 'jefatura_avisada' ? !puedeAvisarJefatura(quien) : !puedeMarcar(quien, { school: crono.school ? { id: '', nombre: crono.school.nombre, distrito: null, ciudad: null, fed_a_cargo: crono.school.fed_a_cargo } : null })) throw new Error(aviso === 'jefatura_avisada' ? 'Sólo el CED puede anotar que se avisó a la jefatura' : 'Sólo el FED a cargo de la escuela o el CED pueden anotar este aviso')
  const { data: previos, error: e0 } = await db.from('cronogramas_seguimiento').select('estado, nota, fed_id, created_at').eq('cronograma_id', id).eq('estado', aviso).order('created_at', { ascending: false }).limit(1)
  if (e0) throw new Error(e0.message)
  if (previos?.length && avisoDe({ historial: previos as unknown as Seguimiento[] }, aviso)) return previos[0] as unknown as Seguimiento
  const fila = { cronograma_id: id, estado: aviso, nota: null, fed_id: yo.fed.id }
  const { data: nuevo, error: e2 } = await db.from('cronogramas_seguimiento').insert(fila).select('created_at').single()
  if (e2) throw new Error(e2.message)
  await audit('cronogramas', id, 'estado', yo.fed.id, fila)
  if (aviso === 'jefatura_avisada') {
    const { data: feds } = await db.from('feds').select('id, nombre_completo').eq('rol', 'fed')
    const dest = (feds ?? []).filter(f => f.id !== yo.fed.id && esDelFed(crono.school?.fed_a_cargo, f.nombre_completo as string))
    if (dest.length) await db.from('notificaciones').insert(dest.map(f => ({ fed_id: f.id as string, autor_id: yo.fed.id, tipo: 'cronograma', detalle: avisoJefaturaFed(crono) })))
  }
  return { estado: aviso, nota: null, fed_id: yo.fed.id, created_at: nuevo.created_at as string }
}

// Contactos de la escuela de un cronograma, para armar el mensaje de aviso (el FED a cargo, el CED y la administración).
export async function getContactosCronogramaImpl(yo: Usuario, id: string): Promise<ContactoEscuela[]> {
  if (!UUID.test(id)) throw new Error('Cronograma inválido')
  const db = supabaseServer()
  const { data: c, error } = await db.from('cronogramas').select('cue, school:establecimientos(nombre, fed_a_cargo)').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  const crono = c as unknown as { cue: number, school: { nombre: string | null, fed_a_cargo: string | null } | null } | null
  if (!crono) throw new Error('No se encontró el cronograma')
  if (!puedeMarcar({ esAdmin: yo.esAdmin, rol: yo.fed.rol, nombre: yo.fed.nombre_completo }, { school: crono.school ? { id: '', nombre: crono.school.nombre, distrito: null, ciudad: null, fed_a_cargo: crono.school.fed_a_cargo } : null })) throw new Error('Estos datos los ve el FED a cargo de la escuela')
  const { data, error: e2 } = await db.from('contactos').select('nombre, apellido, cargo, telefono, correo, correo_laboral, es_principal').eq('cue', crono.cue).order('es_principal', { ascending: false })
  if (e2) throw new Error(e2.message)
  return (data ?? []) as ContactoEscuela[]
}

// Cronogramas de conectividad (en planilla) de esas escuelas, con cómo salió cada uno, agrupados por escuela. Sin lista de escuelas: los que no terminaron, de todas.
export async function cronogramasDeEscuelas(db: ReturnType<typeof supabaseServer>, ids: string[] | null, hoy = hoyAR()): Promise<Map<string, CronoCorto[]>> {
  const filas: { id: string, school_id: string, tipo: string | null, fecha_inicio: string, fecha_fin: string, proveedor: string | null }[] = []
  const traer = async (q: PromiseLike<{ data: unknown[] | null, error: { message: string } | null }>) => { const { data, error } = await q; if (error) throw new Error(error.message); for (const c of (data ?? []) as Record<string, unknown>[]) filas.push({ id: c.id as string, school_id: c.school_id as string, tipo: c.tipo as string | null, fecha_inicio: String(c.fecha_inicio), fecha_fin: String(c.fecha_fin), proveedor: c.proveedor as string | null }) }
  const cols = 'id, school_id, tipo, fecha_inicio, fecha_fin, proveedor'
  if (ids === null) await traer(db.from('cronogramas').select(cols).eq('en_planilla', true).not('school_id', 'is', null).gte('fecha_fin', hoy))
  else for (let i = 0; i < ids.length; i += 100) await traer(db.from('cronogramas').select(cols).eq('en_planilla', true).in('school_id', ids.slice(i, i + 100)))
  // Cómo salió cada uno (el último resultado anotado).
  const estados = new Map<string, EstadoCrono>()
  for (let i = 0; i < filas.length; i += 100) {
    const { data: sg, error } = await db.from('cronogramas_seguimiento').select('cronograma_id, estado, created_at').in('cronograma_id', filas.slice(i, i + 100).map(c => c.id)).in('estado', ['realizado', 'no_realizado', 'reprogramado']).order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    for (const x of sg ?? []) if (!estados.has(x.cronograma_id as string)) estados.set(x.cronograma_id as string, x.estado as EstadoCrono)
  }
  const porEscuela = new Map<string, CronoCorto[]>()
  for (const c of filas) porEscuela.set(c.school_id, [...(porEscuela.get(c.school_id) ?? []), { id: c.id, tipo: c.tipo, fecha_inicio: c.fecha_inicio, fecha_fin: c.fecha_fin, proveedor: c.proveedor, estado: estados.get(c.id) ?? null }])
  return porEscuela
}

// Próximos cronogramas por escuela (los ve cualquiera, como la conectividad).
export async function proximosPorEscuela(db: ReturnType<typeof supabaseServer>, ids: string[] | null): Promise<Map<string, CronoCorto[]>> {
  const hoy = hoyAR(), todos = await cronogramasDeEscuelas(db, ids, hoy), out = new Map<string, CronoCorto[]>()
  for (const [id, l] of todos) { const p = proximosDe(l, hoy); if (p.length) out.set(id, p) }
  return out
}

// Para cada reclamo abierto, los cronogramas de conectividad de su escuela (próximos, o el último posterior al reclamo). Sólo de las escuelas que el usuario ve en Cronogramas.
export async function getCruceReclamosImpl(yo: Usuario): Promise<Record<string, CruceReclamo>> {
  const db = supabaseServer(), hoy = hoyAR()
  const todos = yo.esAdmin || yo.fed.rol === 'coordinacion'
  const { data, error } = await db.from('reclamos_conectividad').select('id, school_id, estado, enviado_at, school:establecimientos(fed_a_cargo)').in('estado', ['enviado', 'en_proceso']).not('school_id', 'is', null)
  if (error) throw new Error(error.message)
  const rec = ((data ?? []) as unknown as { id: string, school_id: string, estado: string, enviado_at: string, school: { fed_a_cargo: string | null } | { fed_a_cargo: string | null }[] | null }[])
    .filter(r => todos || esDelFed([r.school].flat()[0]?.fed_a_cargo, yo.fed.nombre_completo))
  const escuelas = [...new Set(rec.map(r => r.school_id))]
  const porEscuela = await cronogramasDeEscuelas(db, escuelas)
  const out: Record<string, CruceReclamo> = {}
  for (const r of rec) { const x = cruceDe(r, porEscuela.get(r.school_id) ?? [], hoy); if (x.proximos.length || x.pasado) out[r.id] = x }
  return out
}

// Anota cómo salió un cronograma (el último que se anota es el vigente). Si no se realizó o se reprogramó, hace falta el motivo y se avisa al CED.
export async function marcarCronogramaImpl(yo: Usuario, id: string, estado: EstadoSeguimiento, nota: string): Promise<Seguimiento> {
  if (!UUID.test(id)) throw new Error('Cronograma inválido')
  if (!ESTADOS_SEGUIMIENTO.includes(estado)) throw new Error('Estado inválido')
  const texto = nota.trim()
  if (PIDE_MOTIVO.includes(estado) && !texto) throw new Error('Anotá el motivo')
  if (texto.length > MAX_NOTA) throw new Error(`El motivo no puede superar los ${MAX_NOTA} caracteres`)
  const db = supabaseServer()
  const { data: c, error } = await db.from('cronogramas').select('id, cue, fecha_inicio, fecha_fin, tipo, school:establecimientos(nombre, fed_a_cargo)').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  const crono = c as unknown as (Pick<Cronograma, 'id' | 'cue' | 'fecha_inicio' | 'fecha_fin' | 'tipo'> & { school: { nombre: string | null, fed_a_cargo: string | null } | null }) | null
  if (!crono) throw new Error('No se encontró el cronograma')
  if (!puedeMarcar({ esAdmin: yo.esAdmin, rol: yo.fed.rol, nombre: yo.fed.nombre_completo }, { school: crono.school ? { id: '', nombre: crono.school.nombre, distrito: null, ciudad: null, fed_a_cargo: crono.school.fed_a_cargo } : null })) throw new Error('Sólo el FED a cargo de la escuela o el CED pueden anotar el estado')
  const fila = { cronograma_id: id, estado, nota: texto || null, fed_id: yo.fed.id }
  const { data: nuevo, error: e2 } = await db.from('cronogramas_seguimiento').insert(fila).select('created_at').single()
  if (e2) throw new Error(e2.message)
  await audit('cronogramas', id, 'estado', yo.fed.id, fila)
  if (PIDE_MOTIVO.includes(estado)) {
    const { data: ceds } = await db.from('feds').select('id').eq('rol', 'coordinacion')
    const avisos = (ceds ?? []).filter(x => x.id !== yo.fed.id).map(x => ({ fed_id: x.id as string, autor_id: yo.fed.id, tipo: 'cronograma', detalle: avisoEstadoCed(estado, crono, texto || null) }))
    if (avisos.length) await db.from('notificaciones').insert(avisos)
  }
  return { estado, nota: texto || null, fed_id: yo.fed.id, created_at: nuevo.created_at as string }
}

export async function sincronizarCronogramasAhoraImpl(yo: Usuario): Promise<ResultadoSync> {
  if (!yo.esAdmin) throw new Error('Sólo la administración puede sincronizar ahora')
  const db = supabaseServer()
  const reg = await db.from('cron_ejecuciones').insert({ tarea: 'cronogramas-manual' }).select('id').single()
  const cerrar = async (resultado: Record<string, unknown>) => { if (reg.data?.id) await db.from('cron_ejecuciones').update({ fin: new Date().toISOString(), resultado }).eq('id', reg.data.id) }
  try { const r = await sincronizarCronogramas(); await cerrar({ ...r }); return r }
  catch (e) { await cerrar({ error: errMsgServer(e) }); throw e }
}

// ---- Borradores: el reclamo armado queda guardado hasta que el FED lo marca como enviado (por ejemplo, si lo dejó programado en Gmail).
export type AdjuntoBorrador = { texto: string, enlace?: string }
export type Borrador = { id: string, school_id: string | null, cue: number | null, escuela_nombre: string | null, tipo_label: string, asunto: string, para: string | null, cuerpo: string, adjuntos: AdjuntoBorrador[], created_at: string }
const MAX_BORRADORES = 30
const COLS_BORRADOR = 'id, school_id, cue, escuela_nombre, tipo_label, asunto, para, cuerpo, adjuntos, created_at'
export async function guardarBorradorImpl(yo: Usuario, input: { school_id: string, tipo: string, asunto: string, para: string | null, cuerpo: string, adjuntos: AdjuntoBorrador[] }): Promise<string> {
  if (!UUID.test(input.school_id)) throw new Error('Establecimiento inválido')
  const tipo = tipoDe(input.tipo)
  if (!tipo) throw new Error('Tipo de reclamo inválido')
  const asunto = input.asunto.trim(), cuerpo = input.cuerpo.trim()
  if (!cuerpo || cuerpo.length > 8000) throw new Error('El mensaje está vacío o es demasiado largo')
  if (input.para && input.para.length > 200) throw new Error('El destinatario es demasiado largo')
  if (!Array.isArray(input.adjuntos) || input.adjuntos.length > 10 || input.adjuntos.some(a => !a || typeof a.texto !== 'string' || a.texto.length > 200 || (a.enlace !== undefined && !/^https:\/\/docs\.google\.com\//.test(a.enlace)))) throw new Error('Los adjuntos no son válidos')
  const db = supabaseServer()
  const { data: esc, error } = await db.from('establecimientos').select('id, cue, nombre').eq('id', input.school_id).maybeSingle()
  if (error) throw new Error(error.message)
  if (!esc) throw new Error('No se encontró el establecimiento')
  if (!/^06-01-\d{12} - CUE \d{8} - .+/.test(asunto) || !asunto.includes(`CUE ${esc.cue} - `)) throw new Error('El asunto no tiene el formato de la guía')
  // Un mismo asunto no se guarda dos veces (doble toque): si ya estaba, se actualiza el mensaje (por ejemplo, si se cambió el saludo).
  const { data: previo } = await db.from('reclamos_borradores').select('id').eq('fed_id', yo.fed.id).eq('asunto', asunto).maybeSingle()
  if (previo) {
    const up = await db.from('reclamos_borradores').update({ para: input.para || null, cuerpo, adjuntos: input.adjuntos }).eq('id', previo.id as string).eq('fed_id', yo.fed.id)
    if (up.error) throw new Error(up.error.message)
    return previo.id as string
  }
  const { count } = await db.from('reclamos_borradores').select('id', { count: 'exact', head: true }).eq('fed_id', yo.fed.id)
  if ((count ?? 0) >= MAX_BORRADORES) throw new Error(`Tenés ${MAX_BORRADORES} borradores: marcá como enviados o eliminá algunos antes de guardar otro`)
  const row = { fed_id: yo.fed.id, school_id: esc.id, cue: esc.cue, escuela_nombre: esc.nombre, tipo: tipo.id, tipo_label: tipo.asunto, asunto, para: input.para || null, cuerpo, adjuntos: input.adjuntos }
  const { data, error: e2 } = await db.from('reclamos_borradores').insert(row).select('id').single()
  if (e2) throw new Error(e2.message)
  return data.id as string
}
// Cada uno ve y toca solo sus borradores.
export async function getBorradoresImpl(yo: Usuario): Promise<Borrador[]> {
  const { data, error } = await supabaseServer().from('reclamos_borradores').select(COLS_BORRADOR).eq('fed_id', yo.fed.id).order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as Borrador[]
}
export async function eliminarBorradorImpl(yo: Usuario, id: string): Promise<void> {
  if (!UUID.test(id)) throw new Error('Borrador inválido')
  const { data, error } = await supabaseServer().from('reclamos_borradores').delete().eq('id', id).eq('fed_id', yo.fed.id).select('id')
  if (error) throw new Error(error.message)
  if (!data?.length) throw new Error('No se encontró el borrador')
}
// Lo registra como enviado (con la fecha en que salió, hoy por defecto), avisa al CED como cualquier reclamo nuevo y lo saca de los borradores.
export async function enviarBorradorImpl(yo: Usuario, id: string, fecha: string | null): Promise<string> {
  if (!UUID.test(id)) throw new Error('Borrador inválido')
  const hoy = hoyAR()
  if (fecha && (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha > hoy)) throw new Error('La fecha de envío no puede ser futura')
  const db = supabaseServer()
  const { data: b, error } = await db.from('reclamos_borradores').select('id, school_id, tipo, asunto').eq('id', id).eq('fed_id', yo.fed.id).maybeSingle()
  if (error) throw new Error(error.message)
  if (!b) throw new Error('No se encontró el borrador')
  if (!b.school_id) throw new Error('El establecimiento ya no existe: eliminá el borrador')
  const enviadoAt = !fecha || fecha === hoy ? undefined : `${fecha}T12:00:00-03:00`
  const reclamoId = await registrarReclamoImpl(yo, { school_id: b.school_id as string, tipo: b.tipo as string, asunto: b.asunto as string }, enviadoAt)
  const del = await db.from('reclamos_borradores').delete().eq('id', id).eq('fed_id', yo.fed.id)
  if (del.error) throw new Error(del.error.message)
  return reclamoId
}
