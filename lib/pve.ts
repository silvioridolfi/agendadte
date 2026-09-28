import 'server-only'
import { supabaseServer } from '@/lib/supabase-server'
import { DriveError, carpetaVigente, crearCarpeta, darLectura, esCarpeta, listarHijos, renombrar } from '@/lib/drive'
import { hoyAR } from '@/lib/hora'

// Planillas de Visita a Escuelas (PVE): cada FED sube un PDF por mes a "PVE MM-AAAA", dentro de la subcarpeta "PVE"
// de su carpeta de Drive (la misma que usa para las fotos). La agenda lo detecta, lo renombra con el formato del
// instructivo ("R01 - PVE (OCTUBRE 2026) - NOMBRE") y le da permiso de lectura a la coordinación.
export const REGION = 'R01'
// Primer mes que se entrega por la agenda (las anteriores ya se entregaron por fuera).
export const PRIMER_MES = '2026-09-01'
const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']

// Mes como AAAA-MM-01; `desplazamiento` en meses respecto de la fecha dada.
export function inicioMes(fecha: string, desplazamiento = 0) {
  const [y, m] = fecha.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + desplazamiento, 1))
  return d.toISOString().slice(0, 10)
}
export const nombreMes = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1]} ${mes.slice(0, 4)}`
export const carpetaMes = (mes: string) => `PVE ${mes.slice(5, 7)}-${mes.slice(0, 4)}`
export const nombrePve = (mes: string, fed: string) => `${REGION} - PVE (${nombreMes(mes)}) - ${fed.toUpperCase()}.pdf`
export { hoyAR }

// Meses que se pueden entregar: desde el primero por la agenda hasta el actual.
export function mesesEntregables(hoy = hoyAR()) {
  const out: string[] = []
  for (let m = inicioMes(hoy); m >= PRIMER_MES; m = inicioMes(m, -1)) out.push(m)
  return out
}

// Carpeta de un mes: se crea sólo cuando el FED la pide ("Subir"), dentro de la carpeta "PVE" de su Drive.
export async function carpetaDelMes(fedId: string, mes: string): Promise<string> {
  const db = supabaseServer()
  const { data: fed } = await db.from('feds').select('carpeta_fotos_id, carpeta_pve_id').eq('id', fedId).maybeSingle()
  if (!fed?.carpeta_fotos_id) throw new Error('Primero conectá tu carpeta de Drive en “Fotos de las acciones”')
  const { data: fila } = await db.from('pve').select('folder_id').eq('fed_id', fedId).eq('mes', mes).maybeSingle()
  if (fila && (await carpetaVigente(fila.folder_id as string))) return fila.folder_id as string
  let pveId = fed.carpeta_pve_id as string | null
  if (!pveId || !(await carpetaVigente(pveId))) {
    const existente = (await listarHijos(fed.carpeta_fotos_id)).find(f => esCarpeta(f) && f.name === 'PVE')
    pveId = existente?.id ?? (await crearCarpeta('PVE', fed.carpeta_fotos_id)).id
    await db.from('feds').update({ carpeta_pve_id: pveId }).eq('id', fedId)
  }
  const folder = (await listarHijos(pveId)).find(f => esCarpeta(f) && f.name === carpetaMes(mes))?.id ?? (await crearCarpeta(carpetaMes(mes), pveId)).id
  await db.from('pve').upsert({ fed_id: fedId, mes, folder_id: folder, updated_at: new Date().toISOString() })
  return folder
}

export type ResultadoPve = { entregadas: number, nuevas: number }

// Revisa las carpetas de mes que ya existen (no crea ninguna).
export async function revisarPve(fedId: string): Promise<ResultadoPve> {
  const db = supabaseServer()
  const res: ResultadoPve = { entregadas: 0, nuevas: 0 }
  const { data: fed } = await db.from('feds').select('nombre_completo, carpeta_fotos_id, rol').eq('id', fedId).maybeSingle()
  if (!fed?.carpeta_fotos_id || fed.rol !== 'fed') return res
  const desde = inicioMes(hoyAR(), -3) > PRIMER_MES ? inicioMes(hoyAR(), -3) : PRIMER_MES
  const { data: filas } = await db.from('pve').select('mes, folder_id, file_id, enviada_at, devuelta_at, reentregada_at').eq('fed_id', fedId).gte('mes', desde)
  const porMes = new Map((filas ?? []).map(f => [f.mes as string, f]))

  // Coordinación: recibe permiso de lectura y el aviso de cada entrega nueva.
  const { data: coord } = await db.from('feds').select('id, email').eq('rol', 'coordinacion')
  for (const [mes, fila] of porMes) {
    if (fila.enviada_at) { if (fila.file_id) res.entregadas++; continue } // ya enviada a Nivel Central: queda fija
    let pdfs
    try { pdfs = (await listarHijos(fila.folder_id as string)).filter(f => f.mimeType === 'application/pdf') }
    catch (e) { if (e instanceof DriveError && (e.status === 404 || e.status === 403)) continue; throw e }
    // Si hay más de uno, vale el último subido.
    const pdf = pdfs.sort((a, b) => (b.createdTime ?? '').localeCompare(a.createdTime ?? ''))[0]
    if (!pdf) {
      if (fila.file_id) await db.from('pve').update({ file_id: null, nombre: null, entregada_at: null, updated_at: new Date().toISOString() }).eq('fed_id', fedId).eq('mes', mes)
      continue
    }
    res.entregadas++
    const nombre = nombrePve(mes, fed.nombre_completo as string)
    // Versiones anteriores del mes: quedan en la carpeta, renombradas para no confundirlas con la vigente.
    for (const viejo of pdfs.slice(1)) if (viejo.name === nombre) try { await renombrar(viejo.id, nombre.replace(/\.pdf$/, ' (VERSIÓN ANTERIOR).pdf')) } catch { /* sin permiso: queda como está */ }
    if (pdf.name !== nombre) await renombrar(pdf.id, nombre)
    if (pdf.id === fila.file_id) continue
    for (const c of coord ?? []) if (c.email) try { await darLectura(pdf.id, c.email as string) } catch { /* sin permiso para compartir: lo ve igual desde la agenda */ }
    // Si estaba devuelta, el PDF nuevo es la corrección.
    const corregida = !!fila.devuelta_at && !fila.reentregada_at, ahora = new Date().toISOString()
    await db.from('pve').update({ file_id: pdf.id, nombre, entregada_at: ahora, ...(corregida ? { reentregada_at: ahora } : {}), updated_at: ahora }).eq('fed_id', fedId).eq('mes', mes)
    await db.from('pve_historial').insert({ fed_id: fedId, mes, tipo: corregida ? 'reentregada' : 'entregada', autor_id: fedId })
    if (coord?.length) await db.from('notificaciones').insert(coord.map(c => ({ fed_id: c.id, autor_id: fedId, tipo: 'pve', detalle: corregida ? `Reentregó corregida su PVE de ${nombreMes(mes).toLowerCase()}` : `Entregó su PVE de ${nombreMes(mes).toLowerCase()}` })))
    res.nuevas++
  }
  return res
}

// Días hábiles de un mes (sin fines de semana ni los días no laborables indicados).
export function habilesDelMes(mes: string, noLaborables: Set<string> = new Set()) {
  const out: string[] = []
  for (const d = new Date(`${mes}T12:00:00Z`); d.toISOString().slice(0, 7) === mes.slice(0, 7); d.setUTCDate(d.getUTCDate() + 1)) {
    const f = d.toISOString().slice(0, 10)
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6 && !noLaborables.has(f)) out.push(f)
  }
  return out
}
// Vencimiento de la PVE de un mes: el 5.º día hábil del mes siguiente.
export const vencimientoPve = (mes: string, noLaborables: Set<string> = new Set()) => habilesDelMes(inicioMes(mes, 1), noLaborables)[4]
// Feriados nacionales, turísticos y recesos (los aniversarios distritales no cuentan para todos).
export async function noLaborables(desde: string, hasta: string) {
  const { data } = await supabaseServer().from('feriados').select('fecha, tipo').gte('fecha', desde).lte('fecha', hasta).neq('tipo', 'distrital')
  return new Set((data ?? []).map(f => f.fecha as string))
}
