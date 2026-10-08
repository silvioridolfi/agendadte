import 'server-only'
import { supabaseServer } from '@/lib/supabase-server'
import { requerirUsuario, type Usuario } from '@/lib/sesion'
import { DriveError, cuentaTecnica, driveConfigurado, idDeCarpeta, urlCarpeta, verificarCarpeta } from '@/lib/drive'
import { ordenarFotos } from '@/lib/fotos'
import { PRIMER_MES, carpetaDelMes, inicioMes, hoyAR as hoyPve, mesesEntregables, nombreMes, noLaborables, revisarPve, vencimientoPve } from '@/lib/pve'
import { fedsDeFotosPermitidos, veTodoElEquipo } from '@/lib/permisos'
import { audit, datosDeAccion, errMsgServer, quienEs } from '@/lib/servidor/comun'

// Fotos en Drive y PVE: la lógica vive acá; app/actions.ts sólo valida la sesión y delega.
// ---- Fotos en Google Drive: carpeta propia de cada FED, ordenada por día por la cuenta técnica.
export type EstadoFotos = { configurado: boolean, cuentaTecnica: string, url: string | null, nombre: string | null, puedeEditar: boolean, error: string | null }
export async function estadoFotos(yo: Usuario): Promise<EstadoFotos> {
  const { data } = await supabaseServer().from('feds').select('carpeta_fotos_id, carpeta_fotos_url').eq('id', yo.fed.id).maybeSingle()
  const base = { configurado: driveConfigurado(), cuentaTecnica: cuentaTecnica(), url: data?.carpeta_fotos_url ?? null, nombre: null, puedeEditar: false, error: null }
  if (!data?.carpeta_fotos_id || !base.configurado) return base
  try { const v = await verificarCarpeta(data.carpeta_fotos_id); return { ...base, nombre: v.nombre, puedeEditar: v.puedeEditar } }
  catch (e) { return { ...base, error: e instanceof DriveError && (e.status === 404 || e.status === 403) ? 'La cuenta técnica todavía no tiene acceso a la carpeta. Compartila como Editor.' : errMsgServer(e) } }
}
export async function guardarCarpetaFotos(yo: Usuario, url: string) {
  const limpio = url.trim()
  if (!limpio) { await supabaseServer().from('feds').update({ carpeta_fotos_id: null, carpeta_fotos_url: null }).eq('id', yo.fed.id); return }
  if (!/^https:\/\/drive\.google\.com\//.test(limpio)) throw new Error('Pegá el enlace de una carpeta de Google Drive (drive.google.com/…)')
  const id = idDeCarpeta(limpio)
  if (!id) throw new Error('No se reconoce el enlace: abrí la carpeta en Drive y copiá la dirección completa')
  const { error } = await supabaseServer().from('feds').update({ carpeta_fotos_id: id, carpeta_fotos_url: urlCarpeta(id) }).eq('id', yo.fed.id)
  if (error) throw new Error(error.message)
  await audit('feds', yo.fed.id, 'modificacion', yo.fed.id, { carpeta_fotos: urlCarpeta(id) })
}
export async function ordenarMisFotos(yo: Usuario) { return ordenarFotos(yo.fed.id) }


// ---- PVE (Planillas de Visita a Escuelas): el FED sube un PDF por mes a su carpeta; la coordinación las descarga juntas.
export type PveEvento = { tipo: 'entregada' | 'devuelta' | 'reentregada' | 'enviada', motivo: string | null, fecha: string }
// Estado de devolución: `devuelta` (con motivo) mientras no se suba la corregida; `reentregada` cuando ya se subió.
export type PveMes = { mes: string, nombreMes: string, vence: string, carpetaUrl: string | null, entregada: string | null, nombre: string | null, archivoUrl: string | null, enviada: string | null, devuelta: string | null, motivo: string | null, reentregada: string | null, historial: PveEvento[] }
const urlArchivo = (id: string) => `https://drive.google.com/file/d/${id}/view`
export async function misPve(yo: Usuario, revisar = false): Promise<{ conectada: boolean, meses: PveMes[], error: string | null }> {
  const db = supabaseServer()
  const { data: fed } = await db.from('feds').select('carpeta_fotos_id').eq('id', yo.fed.id).maybeSingle()
  if (yo.fed.rol !== 'fed' || !fed?.carpeta_fotos_id) return { conectada: false, meses: [], error: null }
  let error: string | null = null
  if (revisar) { try { await revisarPve(yo.fed.id) } catch (e) { error = e instanceof Error ? e.message : 'No se pudo revisar la carpeta' } }
  const [{ data }, { data: hist }] = await Promise.all([
    db.from('pve').select('mes, folder_id, file_id, nombre, entregada_at, enviada_at, devuelta_at, motivo_devolucion, reentregada_at').eq('fed_id', yo.fed.id).gte('mes', PRIMER_MES),
    db.from('pve_historial').select('mes, tipo, motivo, created_at').eq('fed_id', yo.fed.id).gte('mes', PRIMER_MES).order('created_at'),
  ])
  const nl = await noLaborables(PRIMER_MES, inicioMes(hoyPve(), 2))
  // Todos los meses entregables, tengan o no carpeta (la carpeta se crea al tocar "Subir").
  return { conectada: true, error, meses: mesesEntregables().slice(0, 6).map(mes => { const r = (data ?? []).find(x => x.mes === mes); return { mes, nombreMes: nombreMes(mes), vence: vencimientoPve(mes, nl), carpetaUrl: r ? urlCarpeta(r.folder_id) : null, entregada: r?.file_id ? r.entregada_at : null, nombre: r?.nombre ?? null, archivoUrl: r?.file_id ? urlArchivo(r.file_id) : null, enviada: r?.enviada_at ?? null, devuelta: r?.devuelta_at ?? null, motivo: r?.motivo_devolucion ?? null, reentregada: r?.reentregada_at ?? null, historial: (hist ?? []).filter(h => h.mes === mes).map(h => ({ tipo: h.tipo, motivo: h.motivo, fecha: h.created_at })) } }) }
}
// "Subir": crea (si hace falta) la carpeta del mes en el Drive del FED y devuelve su enlace.
export async function abrirCarpetaPve(yo: Usuario, mes: string) {
  if (yo.fed.rol !== 'fed') throw new Error('Sólo los FED entregan PVE')
  if (!mesesEntregables().includes(mes)) throw new Error('Ese mes no se puede entregar por la agenda')
  return urlCarpeta(await carpetaDelMes(yo.fed.id, mes))
}
async function soloCoordinacion() {
  const yo = await requerirUsuario()
  if (yo.fed.rol !== 'coordinacion' && !yo.esAdmin) throw new Error('Sólo la coordinación puede ver las PVE del equipo')
  return yo
}
export type PveFed = { fedId: string, nombre: string, vence: string, conectada: boolean, entregada: string | null, nombreArchivo: string | null, archivoUrl: string | null, enviada: string | null, devuelta: string | null, motivo: string | null, reentregada: string | null, historial: PveEvento[] }
export async function pveEquipo(mes: string): Promise<PveFed[]> {
  await soloCoordinacion()
  if (!/^\d{4}-\d{2}-01$/.test(mes) || mes < PRIMER_MES) throw new Error('Mes inválido')
  const db = supabaseServer()
  const [{ data: feds }, { data: filas }] = await Promise.all([
    db.from('feds').select('id, nombre_completo, carpeta_fotos_id').eq('rol', 'fed').order('nombre_completo'),
    db.from('pve').select('fed_id, file_id, nombre, entregada_at, enviada_at, devuelta_at, motivo_devolucion, reentregada_at').eq('mes', mes),
  ])
  const { data: hist } = await db.from('pve_historial').select('fed_id, tipo, motivo, created_at').eq('mes', mes).order('created_at')
  const vence = vencimientoPve(mes, await noLaborables(inicioMes(mes, 1), inicioMes(mes, 2)))
  return (feds ?? []).map(f => { const r = (filas ?? []).find(x => x.fed_id === f.id); return { fedId: f.id, nombre: f.nombre_completo, vence, conectada: !!f.carpeta_fotos_id, entregada: r?.file_id ? r.entregada_at : null, nombreArchivo: r?.file_id ? r.nombre : null, archivoUrl: r?.file_id ? urlArchivo(r.file_id) : null, enviada: r?.enviada_at ?? null, devuelta: r?.devuelta_at ?? null, motivo: r?.motivo_devolucion ?? null, reentregada: r?.reentregada_at ?? null, historial: (hist ?? []).filter(h => h.fed_id === f.id).map(h => ({ tipo: h.tipo, motivo: h.motivo, fecha: h.created_at })) } })
}
export async function marcarPveEnviadas(mes: string) {
  const yo = await soloCoordinacion()
  // Las devueltas que todavía no se corrigieron quedan afuera.
  const db = supabaseServer()
  const { data, error } = await db.from('pve').update({ enviada_at: new Date().toISOString(), enviada_por: yo.fed.id }).eq('mes', mes).not('file_id', 'is', null).is('enviada_at', null).or('devuelta_at.is.null,reentregada_at.not.is.null').select('fed_id')
  if (error) throw new Error(error.message)
  if (data?.length) await db.from('pve_historial').insert(data.map(d => ({ fed_id: d.fed_id, mes, tipo: 'enviada', autor_id: yo.fed.id })))
  await audit('pve', null, 'estado', yo.fed.id, { mes, enviadas: data?.length ?? 0 })
  return data?.length ?? 0
}
// Devolver una PVE al FED para que la corrija (también si ya se había enviado a Nivel Central).
export async function devolverPve(fedId: string, mes: string, motivo: string) {
  const yo = await soloCoordinacion()
  const texto = motivo.trim().slice(0, 500)
  if (!texto) throw new Error('Escribí el motivo de la devolución')
  const db = supabaseServer()
  const { data, error } = await db.from('pve').update({ devuelta_at: new Date().toISOString(), motivo_devolucion: texto, reentregada_at: null, enviada_at: null, updated_at: new Date().toISOString() }).eq('fed_id', fedId).eq('mes', mes).not('file_id', 'is', null).select('fed_id')
  if (error) throw new Error(error.message)
  if (!data?.length) throw new Error('Esa PVE no está entregada')
  await db.from('pve_historial').insert({ fed_id: fedId, mes, tipo: 'devuelta', motivo: texto, autor_id: yo.fed.id })
  await db.from('notificaciones').insert({ fed_id: fedId, autor_id: yo.fed.id, tipo: 'pve', detalle: `Devolvió tu PVE de ${nombreMes(mes).toLowerCase()} para corregir: ${texto}` })
  await audit('pve', null, 'estado', yo.fed.id, { fedId, mes, devuelta: texto })
}
// Fotos de una acción: la subcarpeta de la acción si ya tiene fotos asignadas por hora; si no, la carpeta del día, sólo si quedaron fotos sin asignar a ninguna acción.
// Una por cada FED (responsable y participantes) que tenga fotos ordenadas.
export async function fotosDelDia(yo: Usuario, fedIds: string[], fecha: string, itemId?: string) {
  const accion = itemId && !veTodoElEquipo(quienEs(yo)) ? await datosDeAccion(itemId) : null
  const ids = fedsDeFotosPermitidos(quienEs(yo), fedIds, accion).slice(0, 20), db = supabaseServer()
  const [{ data: dias }, { data: acc }] = await Promise.all([
    db.from('fotos_dias').select('fed_id, folder_id').in('fed_id', ids).eq('fecha', fecha),
    itemId ? db.from('fotos_acciones').select('fed_id, folder_id').in('fed_id', ids).eq('item_id', itemId) : Promise.resolve({ data: [] as { fed_id: string, folder_id: string }[] }),
  ])
  const porAccion = new Map((acc ?? []).map(a => [a.fed_id as string, a.folder_id as string]))
  const { data: procesadas } = await db.from('fotos_procesadas').select('fed_id, item_id').in('fed_id', ids).eq('fecha', fecha)
  const cuenta = (id: string, deAccion: boolean) => (procesadas ?? []).filter(p => p.fed_id === id && (deAccion ? p.item_id === itemId : !p.item_id)).length
  return ids.flatMap(id => {
    const a = porAccion.get(id), d = (dias ?? []).find(x => x.fed_id === id)?.folder_id as string | undefined
    return a ? [{ fedId: id, url: urlCarpeta(a), deAccion: true, n: cuenta(id, true) }] : d && cuenta(id, false) ? [{ fedId: id, url: urlCarpeta(d), deAccion: false, n: cuenta(id, false) }] : []
  })
}

// Cantidad de fotos ordenadas: por acción (asignadas por hora) y por FED y día ("fedId|fecha"). Para los contadores del calendario y el tablero.
// `sueltas`: fotos del día que no quedaron asignadas a ninguna acción.
export type ConteoFotos = { items: Record<string, number>, dias: Record<string, number>, sueltas: Record<string, number> }
export async function conteoFotos(yo: Usuario): Promise<ConteoFotos> {
  const db = supabaseServer(), out: ConteoFotos = { items: {}, dias: {}, sueltas: {} }
  // Un FED cuenta solo las fotos propias; la coordinación y la administración, las de todo el equipo.
  const solo = veTodoElEquipo(quienEs(yo)) ? null : yo.fed.id
  for (let desde = 0; ; desde += 1000) {
    let q = db.from('fotos_procesadas').select('fed_id, fecha, item_id').not('fecha', 'is', null)
    if (solo) q = q.eq('fed_id', solo)
    const { data, error } = await q.order('file_id').range(desde, desde + 999)
    if (error) throw new Error(error.message)
    for (const r of data ?? []) {
      const k = `${r.fed_id}|${r.fecha}`
      out.dias[k] = (out.dias[k] ?? 0) + 1
      if (r.item_id) out.items[r.item_id as string] = (out.items[r.item_id as string] ?? 0) + 1
      else out.sueltas[k] = (out.sueltas[k] ?? 0) + 1
    }
    if (!data || data.length < 1000) return out
  }
}
