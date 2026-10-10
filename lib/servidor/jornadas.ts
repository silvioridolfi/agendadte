import 'server-only'
import { supabaseServer } from '@/lib/supabase-server'
import { type Usuario } from '@/lib/sesion'
import { urlCarpeta } from '@/lib/drive'
import { anioAR } from '@/lib/hora'
import { armarJornadas, huellaDe, type CarpetaFotos, type ClubJ, type EncuentroJ, type EscuelaJ, type Jornada, type MarcaCarga, type TipoJornadaReporte } from '@/lib/jornadas'
import { audit, fetchAll, quienEs, UUID } from '@/lib/servidor/comun'
import { veTodoElEquipo } from '@/lib/permisos'
import { realizado, type ConItem } from '@/lib/servidor/agenda'

// Reporte de jornadas pedagógicas (formulario de Nivel Central): una fila por encuentro dictado con participantes. Cada FED ve solo los que creó él (si lo acompaña
// alguien, el responsable de cargarlo es quien lo creó); la coordinación y la administración ven todos. La marca de "ya cargado" es compartida.
const TIPOS: TipoJornadaReporte[] = ['CLUB DE TECNOLOGÍA', 'PRÁCTICAS PROFESIONALIZANTES', 'TALLER/CAPACITACIÓN']
const ESC = 'cue, nombre, distrito'

async function armar(yo: Usuario, soloEncuentro?: string): Promise<Jornada[]> {
  const db = supabaseServer(), desde = `${anioAR() - 1}-01-01`, todos = veTodoElEquipo(quienEs(yo))
  const filas = await fetchAll<EncuentroJ & ConItem & { school: EscuelaJ }>((a, b) => {
    let q = db.from('agenda_encuentros')
      .select(`id, agenda_item_id, fed_id, fecha, tipo, lugar, propuesta, modalidad, tipo_jornada, club_id, destinatarios, inscriptos, asistentes, descripcion, school:establecimientos(${ESC}), item:agenda_items(estado)`)
      .in('tipo', TIPOS).gte('fecha', desde)
    if (!todos) q = q.eq('fed_id', yo.fed.id)
    if (soloEncuentro) q = q.eq('id', soloEncuentro)
    return q.order('fecha').order('id').range(a, b)
  })
  const encuentros = filas.filter(realizado).map(({ item: _item, ...e }) => e as EncuentroJ)
  const clubIds = [...new Set(encuentros.map(e => e.club_id).filter((x): x is string => !!x))]
  const itemIds = [...new Set(encuentros.map(e => e.agenda_item_id).filter((x): x is string => !!x))]

  const clubes: ClubJ[] = []
  for (let i = 0; i < clubIds.length; i += 100) {
    const { data, error } = await db.from('clubes').select(`id, grupo, propuesta, fecha_cierre, school:establecimientos!clubes_school_id_fkey(${ESC}), escuela_origen:establecimientos!clubes_escuela_origen_id_fkey(${ESC})`).in('id', clubIds.slice(i, i + 100))
    if (error) throw new Error(error.message)
    clubes.push(...((data ?? []) as unknown as ClubJ[]))
  }
  const { data: feds, error: eFeds } = await db.from('feds').select('id, nombre_completo')
  if (eFeds) throw new Error(eFeds.message)

  // Fotos: la carpeta de la acción (si ya tiene fotos asignadas por hora) o, si no, la del día con fotos que no quedaron asignadas a ninguna acción.
  const carpetas = new Map<string, { folder: string, fed: string | null }>()
  for (let i = 0; i < itemIds.length; i += 150) {
    const { data, error } = await db.from('fotos_acciones').select('item_id, folder_id, fed_id').in('item_id', itemIds.slice(i, i + 150))
    if (error) throw new Error(error.message)
    for (const c of data ?? []) carpetas.set(c.item_id as string, { folder: c.folder_id as string, fed: (c.fed_id as string | null) ?? null })
  }
  const dias = new Map((await fetchAll<{ fed_id: string, fecha: string, folder_id: string }>((a, b) => db.from('fotos_dias').select('fed_id, fecha, folder_id').gte('fecha', desde).order('fecha').order('fed_id').range(a, b))).map(d => [`${d.fed_id}|${d.fecha}`, d.folder_id]))
  const procesadas = await fetchAll<{ fed_id: string, fecha: string | null, item_id: string | null, file_id: string }>((a, b) => db.from('fotos_procesadas').select('fed_id, fecha, item_id, file_id').gte('fecha', desde).order('file_id').range(a, b))
  const nAccion = new Map<string, number>(), nDia = new Map<string, number>()
  for (const p of procesadas) { if (p.item_id) nAccion.set(p.item_id, (nAccion.get(p.item_id) ?? 0) + 1); else if (p.fecha) nDia.set(`${p.fed_id}|${p.fecha}`, (nDia.get(`${p.fed_id}|${p.fecha}`) ?? 0) + 1) }
  const carpetaAccion = new Map<string, CarpetaFotos>(), carpetaDia = new Map<string, CarpetaFotos>()
  for (const [item, c] of carpetas) if ((nAccion.get(item) ?? 0) > 0) carpetaAccion.set(item, { url: urlCarpeta(c.folder), n: nAccion.get(item)!, fedId: c.fed })
  for (const [clave, folder] of dias) if ((nDia.get(clave) ?? 0) > 0) carpetaDia.set(clave, { url: urlCarpeta(folder), n: nDia.get(clave)! })

  const acompanantes = new Map<string, { fed_id: string, respuesta?: string }[]>()
  for (let i = 0; i < itemIds.length; i += 150) {
    const { data, error } = await db.from('agenda_participantes').select('item_id, fed_id, respuesta').in('item_id', itemIds.slice(i, i + 150))
    if (error) throw new Error(error.message)
    for (const p of data ?? []) acompanantes.set(p.item_id as string, [...(acompanantes.get(p.item_id as string) ?? []), { fed_id: p.fed_id as string, respuesta: p.respuesta as string }])
  }
  const marcas = new Map<string, MarcaCarga>(), encIds = encuentros.map(e => e.id)
  for (let i = 0; i < encIds.length; i += 150) {
    const { data, error } = await db.from('jornadas_cargadas').select('encuentro_id, cargado_por, cargado_at, datos').in('encuentro_id', encIds.slice(i, i + 150))
    if (error) throw new Error(error.message)
    for (const m of data ?? []) marcas.set(m.encuentro_id as string, { por: m.cargado_por as string | null, cuando: m.cargado_at as string, datos: m.datos as string })
  }

  return armarJornadas({ encuentros, clubes, feds: (feds ?? []) as { id: string, nombre_completo: string }[], carpetaAccion, carpetaDia, acompanantes, marcas })
}

export const jornadasImpl = (yo: Usuario): Promise<Jornada[]> => armar(yo)

// Marcar (o desmarcar) un encuentro como ya cargado en el formulario. Un FED sólo los que creó él; la coordinación y la administración, cualquiera.
// Lo que había que cargar se guarda al marcar, para avisar si el encuentro cambió después (se calcula acá: no se confía en lo que mande el navegador).
export async function marcarJornadaImpl(yo: Usuario, encuentroId: string, cargada: boolean): Promise<void> {
  if (!UUID.test(encuentroId)) throw new Error('Encuentro inválido')
  const db = supabaseServer()
  const { data: enc, error } = await db.from('agenda_encuentros').select('id, fed_id').eq('id', encuentroId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!enc || (!veTodoElEquipo(quienEs(yo)) && enc.fed_id !== yo.fed.id)) throw new Error('No podés marcar esta jornada')
  if (!cargada) {
    const { error: e } = await db.from('jornadas_cargadas').delete().eq('encuentro_id', encuentroId)
    if (e) throw new Error(e.message)
  } else {
    const [j] = await armar(yo, encuentroId)
    if (!j) throw new Error('Esta jornada ya no figura en el reporte')
    const { error: e } = await db.from('jornadas_cargadas').upsert({ encuentro_id: encuentroId, cargado_por: yo.fed.id, cargado_at: new Date().toISOString(), datos: huellaDe(j) })
    if (e) throw new Error(e.message)
  }
  await audit('jornadas_cargadas', encuentroId, 'estado', yo.fed.id, { cargada })
}
