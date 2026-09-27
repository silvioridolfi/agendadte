import 'server-only'
import { supabaseServer } from '@/lib/supabase-server'
import { accionPorHora } from '@/lib/horas'
import { DriveError, borrar, carpetaVigente, crearCarpeta, esAtajo, listarHijos, esCarpeta, listarTodo, fechaDeCaptura, listar, minutosDeCaptura, mover, renombrar } from '@/lib/drive'

// Orden de fotos: las imágenes y videos sueltos en la carpeta del FED pasan a la carpeta de su día
// ("30-09-2026 · EP N° 4 (5°) · EES N° 31 (7° Informática - Grupo 1)") y, si la hora de captura coincide con el horario
// de una acción de la agenda, a su subcarpeta ("12:00 · Club EP N° 4 - 4°"). Sin fecha: carpeta "Sin fecha".
// Las fotos se mueven a su carpeta; si una foto queda en el día y después se carga la acción, pasa a la carpeta de la acción.
const SIN_FECHA = '1900-01-01'
const LOTE = 150
const SIGLAS: [RegExp, string][] = [
  [/^Escuela de Educación Secundaria Técnica/i, 'EEST'], [/^Escuela de Educación Secundaria Agraria/i, 'EESA'], [/^Escuela de Educación Secundaria/i, 'EES'],
  [/^Escuela de Educación Primaria/i, 'EP'], [/^Escuela de Educación Especial/i, 'EEE'], [/^Jardín de Infantes/i, 'JI'],
  [/^Instituto Superior de Formación Docente/i, 'ISFD'], [/^Instituto Superior de Formación Técnica/i, 'ISFT'], [/^Centro de Educación Física/i, 'CEF'],
]
const titulo = (s: string) => s.toLowerCase().replace(/(^|[\s(“"])(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase()).replace(/\bN°\s*/gi, 'N° ')
function sigla(nombre: string) {
  const n = titulo(nombre), s = SIGLAS.find(([re]) => re.test(n))
  const corto = s ? n.replace(s[0], s[1]) : n
  return corto.match(/^(.*?N°\s*\d+)/)?.[1] ?? corto
}
const TIPO: Record<string, string> = { 'CLUB DE TECNOLOGÍA': 'Club', 'PRÁCTICAS PROFESIONALIZANTES': 'PEAT' }

type ItemDia = { id: string, accion: string, lugar: string | null, hora_inicio: string | null, hora_fin: string | null, school: { nombre: string | null } | null, club: { grupo: string | null } | null }
const lugarDe = (i: ItemDia) => i.school?.nombre ? sigla(i.school.nombre) : i.lugar ?? titulo(i.accion)
const nombreAccion = (i: ItemDia) => `${i.hora_inicio ? `${i.hora_inicio.slice(0, 5)} · ` : ''}${TIPO[i.accion] ?? titulo(i.accion)} ${lugarDe(i)}${i.club?.grupo ? ` - ${i.club.grupo}` : ''}`.slice(0, 150)

async function itemsDelDia(fedId: string, fecha: string): Promise<ItemDia[]> {
  const db = supabaseServer(), cols = 'id, accion, lugar, hora_inicio, hora_fin, school:establecimientos(nombre), club:clubes(grupo)'
  const [{ data: propias }, { data: part }] = await Promise.all([
    db.from('agenda_items').select(cols).eq('fed_id', fedId).eq('fecha', fecha).neq('estado', 'cancelada'),
    db.from('agenda_participantes').select(`item:agenda_items!inner(${cols}, fecha, estado)`).eq('fed_id', fedId).eq('item.fecha', fecha).neq('item.estado', 'cancelada'),
  ])
  // Encuentros importados de la planilla (sin acción en la agenda): cuentan para el nombre del día, sin horario.
  const { data: importados } = await db.from('agenda_encuentros').select('id, tipo, lugar, school:establecimientos(nombre), club:clubes(grupo)').eq('fed_id', fedId).eq('fecha', fecha).is('agenda_item_id', null)
  const extra = ((importados ?? []) as unknown as { id: string, tipo: string, lugar: string | null, school: ItemDia['school'], club: ItemDia['club'] }[])
    .map(e => ({ id: `enc:${e.id}`, accion: e.tipo, lugar: e.lugar, hora_inicio: null, hora_fin: null, school: e.school, club: e.club }))
  const todos = [...(propias ?? []), ...((part ?? []) as unknown as { item: ItemDia }[]).map(p => p.item), ...extra] as unknown as ItemDia[]
  return [...new Map(todos.map(i => [i.id, i])).values()].sort((a, b) => (a.hora_inicio ?? '99').localeCompare(b.hora_inicio ?? '99'))
}

function nombreDelDia(fecha: string, items: ItemDia[]) {
  if (fecha === SIN_FECHA) return 'Sin fecha (ordenar a mano)'
  // Agrupado por escuela: "EP N° 4 (4°, 5°, 6°)".
  const porLugar = new Map<string, string[]>()
  for (const i of items) { const l = porLugar.get(lugarDe(i)) ?? []; if (i.club?.grupo && !l.includes(i.club.grupo)) l.push(i.club.grupo); porLugar.set(lugarDe(i), l) }
  const partes = [...porLugar].map(([l, g]) => (g.length ? `${l} (${g.sort((a, b) => a.localeCompare(b, 'es', { numeric: true })).join(', ')})` : l))
  const resumen = partes.length ? partes.slice(0, 4).join(' · ') + (partes.length > 4 ? ` y ${partes.length - 4} más` : '') : 'Sin acciones en la agenda'
  // Fecha como DD-MM-AAAA (así la leen en Drive).
  const [y, m, d] = fecha.split('-')
  return `${d}-${m}-${y} · ${resumen}`.slice(0, 180)
}

export type ResultadoOrden = { ordenadas: number, atajos: number, sinFecha: number, porAccion: number, pendientes: number, rescatadas: number }

export async function ordenarFotos(fedId: string): Promise<ResultadoOrden> {
  const db = supabaseServer()
  const { data: fed } = await db.from('feds').select('carpeta_fotos_id').eq('id', fedId).maybeSingle()
  const raiz = fed?.carpeta_fotos_id as string | undefined
  const res: ResultadoOrden = { ordenadas: 0, atajos: 0, sinFecha: 0, porAccion: 0, pendientes: 0, rescatadas: 0 }
  if (!raiz) return res


  const [{ data: dias }, { data: acciones }] = await Promise.all([
    db.from('fotos_dias').select('fecha, folder_id, nombre').eq('fed_id', fedId),
    db.from('fotos_acciones').select('item_id, folder_id, nombre').eq('fed_id', fedId),
  ])
  const carpetasDia = new Map((dias ?? []).map(d => [d.fecha as string, { id: d.folder_id as string, nombre: d.nombre as string | null }]))
  const carpetasAccion = new Map((acciones ?? []).map(a => [a.item_id as string, { id: a.folder_id as string, nombre: a.nombre as string | null }]))
  const itemsCache = new Map<string, ItemDia[]>()
  const items = async (fecha: string) => { if (!itemsCache.has(fecha)) itemsCache.set(fecha, fecha === SIN_FECHA ? [] : await itemsDelDia(fedId, fecha)); return itemsCache.get(fecha)! }

  // Fotos que quedaron dentro de una carpeta eliminada: vuelven a la carpeta del FED para ordenarse de nuevo.
  async function rescatar(carpeta: string) {
    try {
      for (const f of await listarTodo(carpeta)) {
        if (esCarpeta(f)) { await rescatar(f.id); continue }
        if (!f.mimeType.startsWith('image/') && !f.mimeType.startsWith('video/')) continue
        try { await mover(f.id, carpeta, raiz!); await db.from('fotos_procesadas').delete().eq('fed_id', fedId).eq('file_id', f.id); res.rescatadas++ } catch { /* sin permiso sobre ese archivo: queda donde está */ }
      }
    } catch { /* carpeta inexistente: nada que rescatar */ }
  }
  // Crea la carpeta o la renombra si cambió lo cargado en la agenda; si fue borrada en Drive, la vuelve a crear.
  async function asegurar(actual: { id: string, nombre: string | null } | undefined, nombre: string, padre: string, guardar: (id: string) => PromiseLike<unknown>) {
    // Si la carpeta guardada fue eliminada (papelera) o ya no existe, se crea una nueva; nunca se mueve nada a la papelera.
    if (actual && !(await carpetaVigente(actual.id))) { await rescatar(actual.id); actual = undefined }
    if (actual) {
      if (actual.nombre === nombre) return actual.id
      try { await renombrar(actual.id, nombre); await guardar(actual.id); actual.nombre = nombre; return actual.id }
      catch (e) { if (!(e instanceof DriveError && e.status === 404)) throw e }
    }
    const { id } = await crearCarpeta(nombre, padre)
    await guardar(id)
    return id
  }
  const listos = new Map<string, string>()
  async function carpetaDia(fecha: string) {
    const k = `d:${fecha}`
    if (!listos.has(k)) {
      const nombre = nombreDelDia(fecha, await items(fecha))
      const id = await asegurar(carpetasDia.get(fecha), nombre, raiz!, id => db.from('fotos_dias').upsert({ fed_id: fedId, fecha, folder_id: id, nombre, updated_at: new Date().toISOString() }))
      carpetasDia.set(fecha, { id, nombre }); listos.set(k, id)
    }
    return listos.get(k)!
  }
  async function carpetaAccion(fecha: string, item: ItemDia) {
    const k = `a:${item.id}`
    if (!listos.has(k)) {
      const dia = await carpetaDia(fecha), nombre = nombreAccion(item)
      const id = await asegurar(carpetasAccion.get(item.id), nombre, dia, id => db.from('fotos_acciones').upsert({ fed_id: fedId, item_id: item.id, folder_id: id, nombre, updated_at: new Date().toISOString() }))
      carpetasAccion.set(item.id, { id, nombre }); listos.set(k, id)
    }
    return listos.get(k)!
  }

  // Actualiza el nombre de las carpetas de días recientes aunque no tengan fotos nuevas (por si cambió la agenda).
  const recientes = [...carpetasDia.keys()].filter(f => f !== SIN_FECHA).sort().slice(-60)
  for (const fecha of recientes) {
    const actual = carpetasDia.get(fecha)!
    if (await carpetaVigente(actual.id)) { await carpetaDia(fecha); continue }
    // Carpeta eliminada por el FED: las fotos que tenía vuelven a la carpeta principal y se ordenan de nuevo (no se pierden).
    await rescatar(actual.id)
    await db.from('fotos_dias').delete().eq('fed_id', fedId).eq('fecha', fecha)
    await db.from('fotos_procesadas').delete().eq('fed_id', fedId).eq('fecha', fecha)
    carpetasDia.delete(fecha)
  }

  // Repaso de los días recientes (cada foto vive dentro de la carpeta de su día o de su acción):
  // - accesos directos de la versión anterior: la foto original pasa a esa carpeta y el acceso directo se borra;
  // - fotos que quedaron en el día porque la acción todavía no estaba cargada: pasan a la carpeta de su acción;
  // - fotos borradas de Drive: dejan de figurar como procesadas.
  const presentes = new Set<string>()
  const repasar = [...carpetasDia.entries()].filter(([f]) => f !== SIN_FECHA).sort(([a], [b]) => a.localeCompare(b)).slice(-30)
  const accionesDe = new Map<string, string>()
  for (const [itemId, c] of carpetasAccion) accionesDe.set(c.id, itemId)
  async function repasarCarpeta(carpeta: string, fecha: string, enDia: boolean) {
    for (const f of await listarHijos(carpeta)) {
      if (esCarpeta(f)) { if (accionesDe.has(f.id)) await repasarCarpeta(f.id, fecha, false); continue }
      if (esAtajo(f)) {
        const destino = f.shortcutDetails?.targetId
        if (!destino) continue
        // Si la foto ya no está suelta (se borró o ya se movió), sólo se quita el acceso directo; si sigue suelta, se reordena más abajo.
        try { await mover(destino, raiz!, carpeta); presentes.add(destino); await db.from('fotos_procesadas').update({ modo: 'movida' }).eq('fed_id', fedId).eq('file_id', destino); res.rescatadas++ }
        catch (e) { if (!(e instanceof DriveError && (e.status === 404 || e.status === 403 || e.status === 400))) throw e }
        try { await borrar(f.id) } catch (e) { if (!(e instanceof DriveError)) throw e }
        continue
      }
      if (!f.mimeType.startsWith('image/') && !f.mimeType.startsWith('video/')) continue
      presentes.add(f.id)
      if (!enDia || f.mimeType.startsWith('video/')) continue
      const item = accionPorHora(await items(fecha), minutosDeCaptura(f))
      if (!item) continue
      const destino = await carpetaAccion(fecha, item)
      if (destino === carpeta) continue
      await mover(f.id, carpeta, destino); res.porAccion++
      await db.from('fotos_procesadas').update({ item_id: item.id }).eq('fed_id', fedId).eq('file_id', f.id)
    }
  }
  for (const [fecha, c] of repasar) await repasarCarpeta(c.id, fecha, true)
  if (repasar.length) {
    const fechas = repasar.map(([f]) => f)
    const { data: filas } = await db.from('fotos_procesadas').select('file_id').eq('fed_id', fedId).in('fecha', fechas)
    const borradas = (filas ?? []).map(r => r.file_id as string).filter(id => !presentes.has(id))
    for (let i = 0; i < borradas.length; i += 200) await db.from('fotos_procesadas').delete().eq('fed_id', fedId).in('file_id', borradas.slice(i, i + 200))
  }

  const sueltos = (await listar(raiz)).filter(f => f.mimeType.startsWith('image/') || f.mimeType.startsWith('video/'))
  const { data: hechos } = await db.from('fotos_procesadas').select('file_id').eq('fed_id', fedId).in('file_id', sueltos.map(f => f.id).slice(0, 1000))
  const yaHechos = new Set((hechos ?? []).map(h => h.file_id as string))
  // Una foto suelta que figura como procesada es de una versión anterior (acceso directo): se vuelve a ordenar moviéndola.
  const nuevos = sueltos.filter(f => !yaHechos.has(f.id) || !presentes.has(f.id))
  const lote = nuevos.slice(0, LOTE)
  res.pendientes = nuevos.length - lote.length

  for (const f of lote) {
    // Videos: Drive no guarda su fecha de grabación; se usa la fecha en que se subieron (hora argentina) y van a la carpeta del día.
    const esVideo = f.mimeType.startsWith('video/')
    const fecha = fechaDeCaptura(f) ?? (esVideo && f.createdTime ? new Date(f.createdTime).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }) : SIN_FECHA)
    const item = fecha === SIN_FECHA || esVideo ? null : accionPorHora(await items(fecha), minutosDeCaptura(f))
    const destino = item ? await carpetaAccion(fecha, item) : await carpetaDia(fecha)
    // La foto se mueve a su carpeta (sigue siendo del FED). Si se borra una carpeta de la agenda, la próxima pasada
    // devuelve las fotos a la carpeta principal y las vuelve a ordenar.
    await mover(f.id, raiz, destino); res.ordenadas++
    if (fecha === SIN_FECHA) res.sinFecha++
    if (item) res.porAccion++
    await db.from('fotos_procesadas').upsert({ fed_id: fedId, file_id: f.id, fecha: fecha === SIN_FECHA ? null : fecha, item_id: item?.id ?? null, modo: 'movida' })
  }
  return res
}
