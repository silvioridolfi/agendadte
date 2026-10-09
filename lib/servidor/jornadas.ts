import 'server-only'
import { supabaseServer } from '@/lib/supabase-server'
import { type Usuario } from '@/lib/sesion'
import { urlCarpeta } from '@/lib/drive'
import { anioAR } from '@/lib/hora'
import { armarJornadas, type CarpetaFotos, type ClubJ, type EncuentroJ, type EscuelaJ, type Jornada, type TipoJornadaReporte } from '@/lib/jornadas'
import { fetchAll } from '@/lib/servidor/comun'
import { realizado, type ConItem } from '@/lib/servidor/agenda'

// Reporte de jornadas pedagógicas (formulario de Nivel Central): sólo la coordinación y la administración. Lee los encuentros de clubes, PEAT y talleres y capacitaciones
// desde el año anterior (un club puede haber empezado antes de su cierre) y arma una fila por propuesta dictada; los filtros se aplican en pantalla.
const TIPOS: TipoJornadaReporte[] = ['CLUB DE TECNOLOGÍA', 'PRÁCTICAS PROFESIONALIZANTES', 'TALLER/CAPACITACIÓN']
const ESC = 'cue, nombre, distrito'

export async function jornadasImpl(yo: Usuario): Promise<Jornada[]> {
  if (yo.fed.rol !== 'coordinacion' && !yo.esAdmin) throw new Error('Sólo la coordinación y la administración ven el reporte de jornadas')
  const db = supabaseServer(), desde = `${anioAR() - 1}-01-01`
  const filas = await fetchAll<EncuentroJ & ConItem & { school: EscuelaJ }>((a, b) => db.from('agenda_encuentros')
    .select(`id, agenda_item_id, fed_id, fecha, tipo, lugar, propuesta, modalidad, tipo_jornada, club_id, destinatarios, inscriptos, asistentes, descripcion, school:establecimientos(${ESC}), item:agenda_items(estado)`)
    .in('tipo', TIPOS).gte('fecha', desde).order('fecha').order('id').range(a, b))
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
  const carpetas = new Map<string, string>()
  for (let i = 0; i < itemIds.length; i += 150) {
    const { data, error } = await db.from('fotos_acciones').select('item_id, folder_id').in('item_id', itemIds.slice(i, i + 150))
    if (error) throw new Error(error.message)
    for (const c of data ?? []) carpetas.set(c.item_id as string, c.folder_id as string)
  }
  const dias = new Map((await fetchAll<{ fed_id: string, fecha: string, folder_id: string }>((a, b) => db.from('fotos_dias').select('fed_id, fecha, folder_id').gte('fecha', desde).order('fecha').order('fed_id').range(a, b))).map(d => [`${d.fed_id}|${d.fecha}`, d.folder_id]))
  const procesadas = await fetchAll<{ fed_id: string, fecha: string | null, item_id: string | null, file_id: string }>((a, b) => db.from('fotos_procesadas').select('fed_id, fecha, item_id, file_id').gte('fecha', desde).order('file_id').range(a, b))
  const nAccion = new Map<string, number>(), nDia = new Map<string, number>()
  for (const p of procesadas) { if (p.item_id) nAccion.set(p.item_id, (nAccion.get(p.item_id) ?? 0) + 1); else if (p.fecha) nDia.set(`${p.fed_id}|${p.fecha}`, (nDia.get(`${p.fed_id}|${p.fecha}`) ?? 0) + 1) }
  const carpetaAccion = new Map<string, CarpetaFotos>(), carpetaDia = new Map<string, CarpetaFotos>()
  for (const [item, folder] of carpetas) if ((nAccion.get(item) ?? 0) > 0) carpetaAccion.set(item, { url: urlCarpeta(folder), n: nAccion.get(item)! })
  for (const [clave, folder] of dias) if ((nDia.get(clave) ?? 0) > 0) carpetaDia.set(clave, { url: urlCarpeta(folder), n: nDia.get(clave)! })

  return armarJornadas({ encuentros, clubes, feds: (feds ?? []) as { id: string, nombre_completo: string }[], carpetaAccion, carpetaDia })
}
