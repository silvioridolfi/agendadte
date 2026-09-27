import 'server-only'
import { supabaseServer } from '@/lib/supabase-server'
import { DriveError, atajo, crearCarpeta, fechaDeCaptura, listar, mover, renombrar } from '@/lib/drive'

// Orden de fotos: las imágenes y videos sueltos en la carpeta del FED pasan a una subcarpeta por día
// ("2026-09-30 · EP N° 4 (5°) · EES N° 31 (7° Informática - Grupo 1)"), según la fecha de captura.
// Si Drive no permite mover el archivo (permisos del dueño), se deja un acceso directo en la carpeta del día.
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

type ItemDia = { accion: string, lugar: string | null, school: { nombre: string | null } | null, club: { grupo: string | null } | null }
async function nombreDelDia(fedId: string, fecha: string) {
  if (fecha === SIN_FECHA) return 'Sin fecha (ordenar a mano)'
  const db = supabaseServer(), cols = 'accion, lugar, school:establecimientos(nombre), club:clubes(grupo)'
  const [{ data: propias }, { data: part }] = await Promise.all([
    db.from('agenda_items').select(cols).eq('fed_id', fedId).eq('fecha', fecha).neq('estado', 'cancelada'),
    db.from('agenda_participantes').select(`item:agenda_items!inner(${cols}, fecha, estado)`).eq('fed_id', fedId).eq('item.fecha', fecha),
  ])
  const items = [...(propias ?? []), ...((part ?? []) as unknown as { item: ItemDia }[]).map(p => p.item)] as unknown as ItemDia[]
  const partes = [...new Set(items.map(i => {
    const lugar = i.school?.nombre ? sigla(i.school.nombre) : i.lugar ?? titulo(i.accion)
    return i.club?.grupo ? `${lugar} (${i.club.grupo})` : lugar
  }))]
  const resumen = partes.length ? partes.slice(0, 4).join(' · ') + (partes.length > 4 ? ` y ${partes.length - 4} más` : '') : 'Sin acciones en la agenda'
  return `${fecha} · ${resumen}`.slice(0, 180)
}

export type ResultadoOrden = { ordenadas: number, atajos: number, sinFecha: number, pendientes: number }

export async function ordenarFotos(fedId: string): Promise<ResultadoOrden> {
  const db = supabaseServer()
  const { data: fed } = await db.from('feds').select('carpeta_fotos_id').eq('id', fedId).maybeSingle()
  const raiz = fed?.carpeta_fotos_id as string | undefined
  const res: ResultadoOrden = { ordenadas: 0, atajos: 0, sinFecha: 0, pendientes: 0 }
  if (!raiz) return res

  const sueltos = (await listar(raiz)).filter(f => f.mimeType.startsWith('image/') || f.mimeType.startsWith('video/'))
  const { data: hechos } = await db.from('fotos_procesadas').select('file_id').eq('fed_id', fedId).in('file_id', sueltos.map(f => f.id).slice(0, 1000))
  const yaHechos = new Set((hechos ?? []).map(h => h.file_id as string))
  const nuevos = sueltos.filter(f => !yaHechos.has(f.id))
  const lote = nuevos.slice(0, LOTE)
  res.pendientes = nuevos.length - lote.length

  const { data: dias } = await db.from('fotos_dias').select('fecha, folder_id, nombre').eq('fed_id', fedId)
  const carpetas = new Map((dias ?? []).map(d => [d.fecha as string, { id: d.folder_id as string, nombre: d.nombre as string | null }]))
  const resueltas = new Map<string, string>()
  async function carpetaDelDia(fecha: string): Promise<string> {
    const r = resueltas.get(fecha)
    if (r) return r
    const id = await resolver(fecha)
    resueltas.set(fecha, id)
    return id
  }
  async function resolver(fecha: string): Promise<string> {
    const nombre = await nombreDelDia(fedId, fecha)
    const actual = carpetas.get(fecha)
    if (actual) {
      if (actual.nombre !== nombre) {
        try { await renombrar(actual.id, nombre) } catch (e) { if (!(e instanceof DriveError && e.status === 404)) throw e; carpetas.delete(fecha); return resolver(fecha) }
        await db.from('fotos_dias').update({ nombre, updated_at: new Date().toISOString() }).eq('fed_id', fedId).eq('fecha', fecha)
        actual.nombre = nombre
      }
      return actual.id
    }
    const { id } = await crearCarpeta(nombre, raiz!)
    await db.from('fotos_dias').upsert({ fed_id: fedId, fecha, folder_id: id, nombre, updated_at: new Date().toISOString() })
    carpetas.set(fecha, { id, nombre })
    return id
  }

  for (const f of lote) {
    const fecha = fechaDeCaptura(f) ?? SIN_FECHA
    const destino = await carpetaDelDia(fecha)
    let modo = 'movida'
    try { await mover(f.id, raiz, destino); res.ordenadas++ }
    catch (e) {
      if (!(e instanceof DriveError) || (e.status !== 403 && e.status !== 400)) throw e
      await atajo(f.id, f.name, destino); modo = 'atajo'; res.atajos++
    }
    if (fecha === SIN_FECHA) res.sinFecha++
    await db.from('fotos_procesadas').upsert({ fed_id: fedId, file_id: f.id, fecha: fecha === SIN_FECHA ? null : fecha, modo })
  }
  return res
}
