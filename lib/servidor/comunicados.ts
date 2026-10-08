import 'server-only'
import { supabaseServer } from '@/lib/supabase-server'
import type { Usuario } from '@/lib/sesion'
import { hoyAR } from '@/lib/hora'
import { audit } from '@/lib/servidor/comun'
import { destinatariosDe, estadoComunicado, llegaA, ordenarPendientes, puedeEliminarComunicado, validarComunicado, type Comunicado, type EntradaComunicado, type EstadoComunicado, type NivelComunicado } from '@/lib/comunicados'

// Comunicados del CED a los FED. Cada FED ve como banner los que le tocan hasta marcarlos como leídos; el CED y la administración ven quién los leyó y cuándo.
// Las acciones públicas están en app/actions.ts (exigen sesión y llaman a estas funciones con el usuario de la sesión).
export type ComunicadoPendiente = { id: string, titulo: string, texto: string, nivel: NivelComunicado, created_at: string, autor: string }
export type ComunicadoGestion = Comunicado & { estado: EstadoComunicado, autor: string, destinatarios: { fedId: string, nombre: string, leidoAt: string | null }[] }
const COLS_COMUNICADO = 'id, titulo, texto, nivel, fed_ids, autor_id, vence_el, retirado, created_at, editado_at'
const puedeGestionar = (yo: Usuario) => yo.esAdmin || yo.fed.rol === 'coordinacion'

export async function comunicadosPendientes(yo: Usuario): Promise<ComunicadoPendiente[]> {
  const db = supabaseServer(), hoy = hoyAR()
  const [com, lec, feds] = await Promise.all([
    db.from('comunicados').select(COLS_COMUNICADO).eq('retirado', false).order('created_at', { ascending: false }).limit(100),
    db.from('comunicado_lecturas').select('comunicado_id').eq('fed_id', yo.fed.id),
    db.from('feds').select('id, nombre_completo'),
  ])
  if (com.error) throw new Error(com.error.message)
  const leidos = new Set((lec.data ?? []).map(l => l.comunicado_id as string))
  const nombre = new Map((feds.data ?? []).map(f => [f.id as string, f.nombre_completo as string]))
  const pendientes = ((com.data ?? []) as Comunicado[])
    .filter(c => estadoComunicado(c, hoy) === 'vigente' && llegaA(c, { id: yo.fed.id, rol: yo.fed.rol }) && !leidos.has(c.id))
    .map(c => ({ id: c.id, titulo: c.titulo, texto: c.texto, nivel: c.nivel, created_at: c.created_at, autor: (c.autor_id && nombre.get(c.autor_id)) || 'Coordinación' }))
  return ordenarPendientes(pendientes)
}

export async function marcarLeido(yo: Usuario, id: string): Promise<void> {
  const db = supabaseServer()
  const { data } = await db.from('comunicados').select(COLS_COMUNICADO).eq('id', id).maybeSingle()
  const c = data as Comunicado | null
  if (!c || c.retirado || !llegaA(c, { id: yo.fed.id, rol: yo.fed.rol })) throw new Error('Ese comunicado no está disponible')
  // La primera lectura es la que cuenta: si ya estaba leído, no se pisa la hora.
  const { error } = await db.from('comunicado_lecturas').upsert({ comunicado_id: id, fed_id: yo.fed.id }, { onConflict: 'comunicado_id,fed_id', ignoreDuplicates: true })
  if (error) throw new Error(error.message)
}

export async function comunicadosGestion(yo: Usuario): Promise<ComunicadoGestion[]> {
  if (!puedeGestionar(yo)) throw new Error('Sólo el CED o la administración gestionan los comunicados')
  const db = supabaseServer(), hoy = hoyAR()
  const [com, feds] = await Promise.all([
    db.from('comunicados').select(COLS_COMUNICADO).order('created_at', { ascending: false }).limit(100),
    db.from('feds').select('id, nombre_completo, rol').order('nombre_completo'),
  ])
  if (com.error) throw new Error(com.error.message)
  const lista = (com.data ?? []) as Comunicado[]
  const lec = lista.length ? await db.from('comunicado_lecturas').select('comunicado_id, fed_id, leido_at').in('comunicado_id', lista.map(c => c.id)) : { data: [] as { comunicado_id: string, fed_id: string, leido_at: string }[] }
  const leidoAt = new Map((lec.data ?? []).map(l => [`${l.comunicado_id}|${l.fed_id}`, l.leido_at as string]))
  const todos = (feds.data ?? []) as { id: string, nombre_completo: string, rol: string }[]
  const nombre = new Map(todos.map(f => [f.id, f.nombre_completo]))
  return lista.map(c => ({
    ...c, estado: estadoComunicado(c, hoy), autor: (c.autor_id && nombre.get(c.autor_id)) || 'Coordinación',
    destinatarios: destinatariosDe(c, todos).map(f => ({ fedId: f.id, nombre: f.nombre_completo, leidoAt: leidoAt.get(`${c.id}|${f.id}`) ?? null })),
  }))
}

async function entradaValida(e: EntradaComunicado): Promise<EntradaComunicado> {
  const error = validarComunicado(e, hoyAR())
  if (error) throw new Error(error)
  let fedIds = e.fedIds
  if (fedIds) {
    const { data } = await supabaseServer().from('feds').select('id').eq('rol', 'fed').in('id', fedIds)
    fedIds = (data ?? []).map(f => f.id as string)
    if (!fedIds.length) throw new Error('Elegí al menos un FED, o mandalo a todos')
  }
  return { ...e, titulo: e.titulo.trim(), texto: e.texto.trim(), fedIds, venceEl: e.venceEl || null }
}

export async function crear(yo: Usuario, e: EntradaComunicado): Promise<string> {
  if (!puedeGestionar(yo)) throw new Error('Sólo el CED o la administración pueden enviar comunicados')
  const v = await entradaValida(e)
  const { data, error } = await supabaseServer().from('comunicados').insert({ titulo: v.titulo, texto: v.texto, nivel: v.nivel, fed_ids: v.fedIds, vence_el: v.venceEl, autor_id: yo.fed.id }).select('id').single()
  if (error) throw new Error(error.message)
  await audit('comunicados', data.id as string, 'alta', yo.fed.id, { titulo: v.titulo, nivel: v.nivel, destinatarios: v.fedIds ?? 'todos' })
  return data.id as string
}

// Al editar el texto, el título o el nivel, hay que volver a leerlo: se borran las lecturas.
export async function editar(yo: Usuario, id: string, e: EntradaComunicado): Promise<void> {
  if (!puedeGestionar(yo)) throw new Error('Sólo el CED o la administración pueden editar comunicados')
  const db = supabaseServer()
  const { data: previo } = await db.from('comunicados').select('titulo, texto, nivel').eq('id', id).maybeSingle()
  if (!previo) throw new Error('No se encontró el comunicado')
  const v = await entradaValida(e)
  const { error } = await db.from('comunicados').update({ titulo: v.titulo, texto: v.texto, nivel: v.nivel, fed_ids: v.fedIds, vence_el: v.venceEl, editado_at: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(error.message)
  const cambioElMensaje = previo.titulo !== v.titulo || previo.texto !== v.texto || previo.nivel !== v.nivel
  if (cambioElMensaje) await db.from('comunicado_lecturas').delete().eq('comunicado_id', id)
  await audit('comunicados', id, 'modificacion', yo.fed.id, { titulo: v.titulo, nivel: v.nivel, destinatarios: v.fedIds ?? 'todos', pide_leer_de_nuevo: cambioElMensaje })
}

// Borra el comunicado y sus lecturas (cascada). Solo si ya no está vigente: antes hay que retirarlo.
export async function eliminar(yo: Usuario, id: string): Promise<void> {
  if (!puedeGestionar(yo)) throw new Error('Sólo el CED o la administración pueden eliminar comunicados')
  const db = supabaseServer()
  const { data } = await db.from('comunicados').select(COLS_COMUNICADO).eq('id', id).maybeSingle()
  const c = data as Comunicado | null
  if (!c) throw new Error('No se encontró el comunicado')
  if (!puedeEliminarComunicado(estadoComunicado(c, hoyAR()))) throw new Error('Primero hay que retirarlo')
  const { error } = await db.from('comunicados').delete().eq('id', id)
  if (error) throw new Error(error.message)
  await audit('comunicados', id, 'baja', yo.fed.id, { eliminado: true, titulo: c.titulo })
}

export async function retirar(yo: Usuario, id: string): Promise<void> {
  if (!puedeGestionar(yo)) throw new Error('Sólo el CED o la administración pueden retirar comunicados')
  const { error } = await supabaseServer().from('comunicados').update({ retirado: true }).eq('id', id)
  if (error) throw new Error(error.message)
  await audit('comunicados', id, 'baja', yo.fed.id)
}
